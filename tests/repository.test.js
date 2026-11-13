const test = require('node:test');
const assert = require('node:assert/strict');
const { createRepository, periodBounds } = require('../miniprogram/services/repository');

function fixture(extra = {}) {
  let state;
  let sequence = 0;
  const repo = createRepository(Object.assign({
    mode: 'demo', now: () => new Date(2026, 10, 12, 12), id: prefix => `${prefix}-test-${++sequence}`,
    storage: { get: () => state, set: (_, value) => { state = JSON.parse(JSON.stringify(value)); }, saveFile: async path => 'saved:' + path }
  }, extra));
  return { repo, snapshot: () => state };
}

async function pending(repo, kind = 'lab') {
  const doc = await repo.uploadDocument({ personId: 'person-he', kind, files: [{ path: 'wxfile://sample', name: 'sample.jpg', type: 'image' }] });
  return repo.recognizeDocument(doc.id);
}

test('cross-person detail, file and medication access is rejected', async () => {
  const { repo } = fixture();
  const doc = await pending(repo);
  await repo.setActivePerson('person-man');
  for (const operation of [repo.getVisit('visit-1'), repo.getDocument(doc.id), repo.getMedication('med-1'), repo.getFileUrl(doc.files[0]), repo.listVisits({ personId: 'person-he' })]) {
    await assert.rejects(operation, /当前档案|其他档案|对应的健康档案/);
  }
});

test('shared report is counted once even when referenced in two visits', async () => {
  const { repo } = fixture();
  const overview = await repo.getOverview('person-he', 'quarter');
  assert.equal(overview.visitCount, 2);
  assert.equal(overview.documentCount, 1);
  assert.equal(overview.episodeCount, 1);
  const a = await repo.getVisit('visit-1'), b = await repo.getVisit('visit-2');
  assert(a.documents.some(d => d.id === 'doc-2'));
  assert(b.documents.some(d => d.id === 'doc-2'));
});

test('symptom filter excludes negated text; full text retains the exact source', async () => {
  const { repo } = fixture();
  const args = { personId: 'person-he', query: '咳嗽' };
  assert.equal((await repo.listVisits({ ...args, category: 'symptom' })).length, 2);
  const all = await repo.listVisits({ ...args, category: 'all' });
  assert.equal(all.length, 3);
  assert.match(all.find(v => v.id === 'visit-3').matchText, /无咳嗽/);
});

test('recognition does not fabricate a date and corrections retain original file', async () => {
  const { repo } = fixture();
  const doc = await pending(repo);
  assert.equal(doc.extracted.date, '');
  const original = JSON.parse(JSON.stringify(doc.files));
  const result = await repo.confirmDocument({ id: doc.id, version: doc.version, extracted: { ...doc.extracted, date: '2025-12-31', conclusion: '阴性，原文保留。' }, visitId: 'visit-1' });
  assert.deepEqual(result.document.files, original);
  assert.equal(result.document.extracted.conclusion, '阴性，原文保留。');
  assert.equal((await repo.getVisit('visit-1')).documents.filter(d => d.kind === 'lab').length, 2);
});

test('unlinked confirmed document can later link to a visit without duplication', async () => {
  const { repo } = fixture();
  const doc = await pending(repo);
  const result = await repo.confirmDocument({ id: doc.id, version: doc.version, extracted: doc.extracted });
  assert.equal(result.visitId, '');
  assert.equal((await repo.listDocuments('person-he', { unlinked: true })).length, 1);
  const linked = await repo.linkDocument({ documentId: doc.id, visitId: 'visit-1', version: result.document.version });
  await repo.linkDocument({ documentId: doc.id, visitId: 'visit-2', version: linked.version });
  assert.equal((await repo.listDocuments('person-he')).filter(d => d.id === doc.id).length, 1);
});

test('new visit requires known date and matching patient', async () => {
  const { repo } = fixture();
  const doc = await pending(repo, 'medical');
  await assert.rejects(repo.confirmDocument({ id: doc.id, version: doc.version, extracted: doc.extracted, createVisit: true }), /有效日期/);
  await assert.rejects(repo.confirmDocument({ id: doc.id, version: doc.version, extracted: { ...doc.extracted, patientName: '别人', date: '2026-11-12' } }), /姓名/);
  assert.equal((await repo.getDocument(doc.id)).status, 'review');
});

test('prescription creates one actual-use entry per medicine without inferred intake dates', async () => {
  const { repo } = fixture();
  const doc = await pending(repo, 'prescription');
  const result = await repo.confirmDocument({ id: doc.id, version: doc.version, extracted: { ...doc.extracted, date: '2026-11-01', medications: [{ name: '示例药 A' }, { name: '示例药 B' }] }, createVisit: true });
  const detail = await repo.getVisit(result.visitId);
  assert.equal(detail.medications.length, 2);
  detail.medications.forEach(m => { assert.equal(m.startDate, ''); assert.equal(m.stopDate, ''); });
  await assert.rejects(repo.confirmDocument({ id: doc.id, version: result.document.version, extracted: result.document.extracted }), /已经确认/);
});

test('actual use validates dates and version without changing prescription or original', async () => {
  const { repo } = fixture();
  const original = await repo.getDocument('doc-3');
  await assert.rejects(repo.updateMedication({ id: 'med-1', version: 1, startDate: '2026-11-12', stopDate: '2026-11-11' }), /停止日期/);
  const updated = await repo.updateMedication({ id: 'med-1', version: 1, startDate: '2026-11-09', stopDate: '', note: '实际用药备注' });
  assert.equal(updated.version, 2);
  assert.equal(updated.note, '实际用药备注');
  await assert.rejects(repo.updateMedication({ id: 'med-1', version: 1, startDate: '' }), /刷新/);
  assert.deepEqual(await repo.getDocument('doc-3'), original);
});

test('calendar dates, period boundary and historical uploads use event date', async () => {
  const { repo } = fixture();
  assert.deepEqual(periodBounds('quarter', new Date(2026, 10, 12)), { start: '2026-10-01', end: '2026-11-12' });
  await assert.rejects(repo.savePerson({ name: '测试', birthDate: '2025-02-29' }), /日期不存在/);
  const records = await repo.listVisits({ personId: 'person-he', start: '2026-08-01', end: '2026-08-31' });
  assert.deepEqual(records.map(v => v.id), ['visit-3']);
});

test('cloud failure never writes or returns simulated success', async () => {
  let writes = 0;
  const repo = createRepository({ mode: 'cloud', storage: { get: () => null, set: () => { writes++; } }, cloud: async () => { throw new Error('not deployed'); } });
  await assert.rejects(repo.boot(), /not deployed/);
  assert.equal(writes, 0);
});

test('file preservation failure does not create a document', async () => {
  const { repo } = fixture({ storage: { get: () => null, set: () => {}, saveFile: async () => { throw new Error('disk full'); } } });
  await assert.rejects(pending(repo), /disk full/);
});

test('final archive destination replaces the initial upload suggestion', async () => {
  const { repo } = fixture();
  const upload = await repo.uploadDocument({ personId: 'person-he', kind: 'medical', files: [{ path: 'wxfile://sample' }], visitId: 'visit-1' });
  const doc = await repo.recognizeDocument(upload.id);
  const result = await repo.confirmDocument({ id: doc.id, version: doc.version, extracted: doc.extracted });
  assert.deepEqual(result.document.visitIds, []);
  const other = await repo.uploadDocument({ personId: 'person-he', kind: 'medical', files: [{ path: 'wxfile://sample-2' }], visitId: 'visit-1' });
  const final = await repo.confirmDocument({ id: other.id, version: other.version, extracted: { patientName: '小禾', date: '2026-11-12' }, createVisit: true });
  assert.deepEqual(final.document.visitIds, [final.visitId]);
  assert.notEqual(final.visitId, 'visit-1');
});

test('supplemental medical documents contribute confirmed symptoms and diagnoses to search', async () => {
  const { repo } = fixture();
  const doc = await pending(repo, 'medical');
  await repo.confirmDocument({ id: doc.id, version: doc.version, visitId: 'visit-1', extracted: { ...doc.extracted, diagnosis: '新增诊断原文', symptoms: ['新增症状'], chiefComplaint: '新增主诉原文' } });
  for (const [category, query] of [['diagnosis', '新增诊断'], ['symptom', '新增症状'], ['all', '新增主诉']]) {
    const hits = await repo.listVisits({ personId: 'person-he', category, query });
    assert.deepEqual(hits.map(v => v.id), ['visit-1']);
  }
});

test('partial file failure cleans only copies already saved by this upload', async () => {
  const removed = [];
  let saved = 0, state;
  const { repo } = fixture({ storage: { get: () => state, set: (_, d) => { state = d; }, saveFile: async p => { if (++saved === 2) throw new Error('full'); return 'copy:' + p; }, removeFile: async p => { removed.push(p); } } });
  await assert.rejects(repo.uploadDocument({ personId: 'person-he', kind: 'lab', files: [{ path: 'first' }, { path: 'second' }] }), /full/);
  assert.deepEqual(removed, ['copy:first']);
  assert.equal(state.documents.length, 6);
});

test('winter spans the next year and leap-year February remains valid', () => {
  const { getRange } = require('../miniprogram/pages/archive/ranges');
  const range = getRange({ type: 'season', year: 2023, season: 'winter' });
  assert.equal(range.start, '2023-12-01');
  assert.equal(range.end, '2024-02-29');
});
