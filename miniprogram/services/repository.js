const seed = require('../data/demo');
const config = require('../config');
const callCloud = require('./cloud');

const KEY = 'babycare.demo.v1';
const clone = value => JSON.parse(JSON.stringify(value));
const text = value => typeof value === 'string' ? value.trim() : '';
const pad = n => String(n).padStart(2, '0');
const day = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function validDate(value, optional) {
  if (!value && optional) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('请填写有效日期。');
  const [y, m, d] = value.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) throw new Error('日期不存在，请重新核对。');
  return value;
}

function periodBounds(period, now) {
  const end = day(now);
  if (period === 'recent') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    return { start: day(start), end };
  }
  if (period === 'quarter') return { start: `${now.getFullYear()}-${pad(Math.floor(now.getMonth() / 3) * 3 + 1)}-01`, end };
  return { start: `${now.getFullYear()}-01-01`, end };
}

function normalizeExtracted(input) {
  const src = input || {};
  const output = {};
  ['patientName', 'age', 'date', 'hospital', 'department', 'doctor', 'chiefComplaint', 'examination', 'diagnosis', 'findings', 'conclusion', 'collectionDate', 'reportDate', 'prescriptionDate'].forEach(k => { output[k] = text(src[k]); });
  ['date', 'collectionDate', 'reportDate', 'prescriptionDate'].forEach(k => validDate(output[k], true));
  output.symptoms = Array.isArray(src.symptoms) ? src.symptoms.map(text).filter(Boolean) : [];
  output.needsReview = Array.isArray(src.needsReview) ? src.needsReview.map(text).filter(Boolean) : [];
  output.items = (Array.isArray(src.items) ? src.items : []).map(item => {
    const result = {};
    ['name', 'value', 'unit', 'referenceRange', 'flag'].forEach(k => { result[k] = text(item && item[k]); });
    return result;
  });
  output.medications = (Array.isArray(src.medications) ? src.medications : []).map(item => {
    const result = {};
    ['name', 'specification', 'dose', 'frequency', 'duration'].forEach(k => { result[k] = text(item && item[k]); });
    return result;
  });
  return output;
}

function createRepository(options) {
  const storage = options.storage;
  const now = options.now || (() => new Date());
  const uid = options.id || (prefix => prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9));
  const mode = options.mode || 'demo';
  const cloud = options.cloud;

  function read() {
    const data = storage.get(KEY);
    if (!data) {
      const initial = seed();
      storage.set(KEY, initial);
      return clone(initial);
    }
    if (data.schemaVersion !== 1 || !Array.isArray(data.persons) || !Array.isArray(data.documents)) {
      throw new Error('本机演示数据格式异常，请先保留资料，再通过设置重置演示。');
    }
    return clone(data);
  }
  function mutate(kind, targetId, fn) {
    const data = read();
    const result = fn(data);
    data.audit.push({ action: kind, targetId, actor: '我（演示）', at: now().toISOString() });
    data.audit = data.audit.slice(-200);
    storage.set(KEY, data);
    return clone(result);
  }
  function owned(data, table, id) {
    const entity = data[table].find(row => row.id === id);
    if (!entity || entity.personId !== data.activePersonId) throw new Error('记录不属于当前档案，请返回后重新选择。');
    return entity;
  }
  function person(data, personId, active) {
    const entity = data.persons.find(row => row.id === personId);
    if (!entity || (active && data.activePersonId !== personId)) throw new Error('请先切换到对应的健康档案。');
    return entity;
  }
  function version(entity, expected) {
    if (entity.version !== expected) throw new Error('记录已经更新，请刷新后再修改，避免覆盖其他修改。');
  }
  function enrichedVisit(data, v) {
    return Object.assign({}, v, { documentCount: data.documents.filter(d => d.personId === v.personId && d.visitIds.includes(v.id)).length });
  }
  function dateIn(value, start, end) { return !!value && (!start || value >= start) && (!end || value <= end); }
  async function preserve(path) {
    if (!text(path)) throw new Error('未找到本地文件，请重新选择。');
    return storage.saveFile ? storage.saveFile(path) : path;
  }
  async function discard(paths) {
    if (!storage.removeFile) return;
    await Promise.all([...new Set(paths)].filter(Boolean).map(path => storage.removeFile(path).catch(() => {})));
  }

  const local = {
    async boot() {
      const d = read();
      return { persons: d.persons, activePersonId: d.activePersonId, family: d.family, mode: 'demo' };
    },
    async getActivePerson() { const d = read(); return d.persons.find(p => p.id === d.activePersonId) || null; },
    async setActivePerson(id) {
      return mutate('selectPerson', id, d => { const p = person(d, id); d.activePersonId = id; return p; });
    },
    async listPersons() { return read().persons; },
    async savePerson(input) {
      const name = text(input.name);
      if (!name || name.length > 40) throw new Error('请填写 1—40 个字的名称。');
      const birthDate = validDate(text(input.birthDate), true);
      if (birthDate && birthDate > day(now())) throw new Error('出生日期不能晚于今天。');
      let avatarPath = text(input.avatarPath);
      const previous = input.id && read().persons.find(p => p.id === input.id);
      if (input.id) {
        if (!previous) throw new Error('档案不存在，请刷新后再试。');
        version(previous, input.version);
      }
      if (avatarPath && (!previous || avatarPath !== previous.avatarPath)) avatarPath = await preserve(avatarPath);
      return mutate('savePerson', input.id || '', d => {
        let p;
        if (input.id) { p = person(d, input.id); version(p, input.version); p.version += 1; }
        else { p = { id: uid('person'), version: 1 }; d.persons.push(p); }
        Object.assign(p, { name, birthDate, avatarPath });
        return p;
      });
    },
    async getOverview(personId, period) {
      const d = read(); person(d, personId, true);
      const range = periodBounds(period, now());
      const vs = d.visits.filter(v => v.personId === personId && dateIn(v.date, range.start, range.end));
      const docs = d.documents.filter(v => v.personId === personId && v.status === 'confirmed' && dateIn(v.extracted.date, range.start, range.end));
      return {
        visitCount: vs.length,
        documentCount: docs.filter(v => v.kind === 'lab').length,
        prescriptionCount: docs.filter(v => v.kind === 'prescription').length,
        episodeCount: new Set(vs.map(v => v.episodeId).filter(Boolean)).size,
        recentVisits: vs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map(v => enrichedVisit(d, v)),
        rangeLabel: `${range.start} — ${range.end}`
      };
    },
    async listVisits(input) {
      const d = read(); person(d, input.personId, true);
      const start = validDate(text(input.start), true), end = validDate(text(input.end), true);
      if (start && end && start > end) throw new Error('开始日期不能晚于结束日期。');
      const q = text(input.query).toLowerCase();
      const category = input.category || 'all';
      return d.visits.filter(v => v.personId === input.personId && ((!start && !end) || dateIn(v.date, start, end))).map(v => {
        const docs = d.documents.filter(doc => doc.personId === input.personId && doc.status === 'confirmed' && doc.visitIds.includes(v.id));
        const labs = docs.filter(doc => doc.kind === 'lab').map(doc => [doc.extracted.findings, doc.extracted.conclusion].concat(doc.extracted.items.map(i => `${i.name} ${i.value} ${i.unit} ${i.flag}`)).join(' ')).join(' ');
        const meds = docs.filter(doc => doc.kind === 'prescription').map(doc => doc.extracted.medications.map(m => m.name).join(' ')).join(' ');
        const medical = docs.filter(doc => doc.kind === 'medical');
        const symptoms = v.symptoms.concat(...medical.map(doc => doc.extracted.symptoms));
        const diagnoses = [v.diagnosis].concat(medical.map(doc => doc.extracted.diagnosis)).filter(Boolean);
        const complaints = [v.chiefComplaint].concat(medical.map(doc => doc.extracted.chiefComplaint)).filter(Boolean);
        const fields = { symptom: ['症状', [...new Set(symptoms)].join(' ')], diagnosis: ['诊断', [...new Set(diagnoses)].join('；')], lab: ['检查结果', labs], medication: ['处方', meds] };
        const candidates = category === 'all' ? [['主诉原文', [...new Set(complaints)].join('；')], fields.symptom, fields.diagnosis, fields.lab, fields.medication, ['医院', v.hospital]] : [fields[category] || ['', '']];
        const hit = candidates.find(field => field[1] && field[1].toLowerCase().includes(q));
        if ((q || category === 'lab' || category === 'medication') && !hit) return null;
        return Object.assign(enrichedVisit(d, v), { matchText: q && hit ? `命中${hit[0]}：${hit[1]}` : '' });
      }).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
    },
    async getVisit(id) {
      const d = read(); const v = owned(d, 'visits', id);
      const documents = d.documents.filter(doc => doc.personId === v.personId && doc.visitIds.includes(id));
      return { visit: enrichedVisit(d, v), documents, medications: d.medications.filter(m => m.personId === v.personId && documents.some(doc => doc.id === m.documentId)) };
    },
    async listDocuments(personId, filter) {
      const d = read(); person(d, personId, true);
      return d.documents.filter(doc => doc.personId === personId && (!(filter && filter.unlinked) || doc.visitIds.length === 0));
    },
    async getDocument(id) { const d = read(); return owned(d, 'documents', id); },
    async uploadDocument(input) {
      const snapshot = read(); person(snapshot, input.personId, true);
      if (!['medical', 'lab', 'prescription'].includes(input.kind)) throw new Error('请选择正确的资料类型。');
      if (!Array.isArray(input.files) || !input.files.length || input.files.length > 9) throw new Error('每份资料请选择 1—9 个文件。');
      if (input.visitId) owned(snapshot, 'visits', input.visitId);
      const files = [];
      input.files.forEach(f => { if (f.size && f.size > 20 * 1024 * 1024) throw new Error('单个文件请控制在 20MB 以内。'); });
      try {
        for (const f of input.files) {
          files.push({ id: uid('file'), path: await preserve(f.path), name: text(f.name) || '上传资料', type: f.type === 'pdf' || /\.pdf$/i.test(f.name || '') ? 'pdf' : 'image' });
        }
        return mutate('uploadDocument', '', d => {
        person(d, input.personId, true);
        if (input.visitId) owned(d, 'visits', input.visitId);
        const doc = { id: uid('document'), personId: input.personId, kind: input.kind, files, visitIds: input.visitId ? [input.visitId] : [], status: 'uploaded', extracted: normalizeExtracted({}), version: 1, createdBy: '我（演示）', updatedAt: now().toISOString() };
        d.documents.push(doc); return doc;
        });
      } catch (error) {
        await discard(files.map(f => f.path));
        throw error;
      }
    },
    async recognizeDocument(id) {
      return mutate('recognizeDocument', id, d => {
        const doc = owned(d, 'documents', id);
        if (doc.status === 'confirmed') throw new Error('资料已归档，不可用再次识别覆盖已确认内容。');
        const p = person(d, doc.personId, true);
        doc.extracted = normalizeExtracted({ patientName: p.name, hospital: '模拟识别：请核对医院', date: '', needsReview: ['演示模式未读取照片内容，以下为模拟字段，请手动核对。'], medications: doc.kind === 'prescription' ? [{ name: '示例药品（请核对）' }] : [], items: doc.kind === 'lab' ? [{ name: '示例检查项目（请核对）', value: '' }] : [] });
        doc.status = 'review'; doc.version += 1; doc.updatedAt = now().toISOString(); return doc;
      });
    },
    async confirmDocument(input) {
      const extracted = normalizeExtracted(input.extracted);
      return mutate('confirmDocument', input.id, d => {
        const doc = owned(d, 'documents', input.id); version(doc, input.version);
        if (doc.status === 'confirmed') throw new Error('这份资料已经确认归档。');
        const p = person(d, doc.personId, true);
        if (extracted.patientName && extracted.patientName.replace(/\s/g, '') !== p.name.replace(/\s/g, '')) throw new Error('单据姓名与当前档案不一致，请核对所属人。');
        let visitId = input.visitId || '';
        if (input.createVisit && visitId) throw new Error('请选择一种归档方式。');
        if (visitId) owned(d, 'visits', visitId);
        if (input.createVisit) {
          validDate(extracted.date, false);
          const v = { id: uid('visit'), personId: doc.personId, date: extracted.date, hospital: extracted.hospital, doctor: extracted.doctor, chiefComplaint: extracted.chiefComplaint, examination: extracted.examination, diagnosis: extracted.diagnosis, symptoms: extracted.symptoms, episodeId: '', version: 1 };
          d.visits.push(v); visitId = v.id;
        }
        // Confirmation is an explicit destination decision. Earlier upload context
        // is only a suggestion; later multi-visit references use linkDocument.
        doc.visitIds = visitId ? [visitId] : [];
        doc.extracted = extracted; doc.status = 'confirmed'; doc.version += 1; doc.updatedAt = now().toISOString();
        if (doc.kind === 'prescription') {
          extracted.medications.filter(m => m.name).forEach(m => d.medications.push(Object.assign({}, m, { id: uid('medication'), personId: doc.personId, documentId: doc.id, visitId, startDate: '', stopDate: '', note: '', version: 1 })));
        }
        return { document: doc, visitId: visitId || doc.visitIds[0] || '' };
      });
    },
    async linkDocument(input) {
      return mutate('linkDocument', input.documentId, d => {
        const doc = owned(d, 'documents', input.documentId); version(doc, input.version);
        const v = owned(d, 'visits', input.visitId);
        if (doc.personId !== v.personId) throw new Error('不能关联到其他人的就诊。');
        if (!doc.visitIds.includes(v.id)) doc.visitIds.push(v.id);
        doc.version += 1; doc.updatedAt = now().toISOString(); return doc;
      });
    },
    async getMedication(id) { const d = read(); return owned(d, 'medications', id); },
    async updateMedication(input) {
      const startDate = validDate(text(input.startDate), true), stopDate = validDate(text(input.stopDate), true);
      if (startDate && stopDate && stopDate < startDate) throw new Error('停止日期不能早于开始日期。');
      return mutate('updateMedication', input.id, d => {
        const m = owned(d, 'medications', input.id); version(m, input.version);
        Object.assign(m, { startDate, stopDate, note: text(input.note), version: m.version + 1, updatedBy: '我（演示）', updatedAt: now().toISOString() });
        return m;
      });
    },
    async getFileUrl(file) {
      const d = read();
      const doc = d.documents.find(row => row.files.some(f => f.id === file.id));
      if (!doc || doc.personId !== d.activePersonId) throw new Error('无法查看其他档案的原件。');
      return doc.files.find(f => f.id === file.id).path || '';
    },
    async getFamily() { return read().family; },
    async resetDemo() {
      const d = read();
      const paths = d.documents.flatMap(doc => doc.files.map(f => f.path)).concat(d.persons.map(p => p.avatarPath));
      storage.set(KEY, seed());
      await discard(paths);
      return true;
    }
  };

  const api = {};
  Object.keys(local).forEach(name => {
    api[name] = async function (...args) {
      if (mode === 'demo') return local[name](...args);
      if (mode !== 'cloud' || !cloud) throw new Error('数据服务配置无效，操作没有保存。');
      return cloud(name, { args });
    };
  });
  return api;
}

const storage = {
  get(key) { return wx.getStorageSync(key); },
  set(key, value) { wx.setStorageSync(key, value); },
  saveFile(path) {
    return new Promise((resolve, reject) => {
      wx.saveFile({ tempFilePath: path, success: result => resolve(result.savedFilePath), fail: () => reject(new Error('本机文件保存失败，请检查剩余空间后重试。')) });
    });
  },
  removeFile(path) {
    return new Promise((resolve, reject) => {
      wx.removeSavedFile({ filePath: path, success: resolve, fail: reject });
    });
  }
};
module.exports = createRepository({ storage, mode: config.mode, cloud: callCloud });
module.exports.createRepository = createRepository;
module.exports.periodBounds = periodBounds;
