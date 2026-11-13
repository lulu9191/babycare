module.exports = function demoState() {
  const persons = [
    { id: 'person-he', name: '小禾', birthDate: '2022-04-18', avatarPath: '', version: 1 },
    { id: 'person-man', name: '小满', birthDate: '2020-08-09', avatarPath: '', version: 1 }
  ];
  const visits = [
    { id: 'visit-1', personId: 'person-he', date: '2026-11-08', hospital: '示例儿童医院', doctor: '示例医生', chiefComplaint: '咳嗽三天，无发热。', examination: '示例查体文字，非真实医疗记录。', diagnosis: '急性支气管炎', symptoms: ['咳嗽'], episodeId: 'episode-cough', version: 1 },
    { id: 'visit-2', personId: 'person-he', date: '2026-11-11', hospital: '示例儿童医院', doctor: '示例医生', chiefComplaint: '咳嗽复诊。', examination: '示例查体文字。', diagnosis: '咳嗽复诊', symptoms: ['咳嗽'], episodeId: 'episode-cough', version: 1 },
    { id: 'visit-3', personId: 'person-he', date: '2026-08-14', hospital: '示例综合医院', doctor: '示例医生', chiefComplaint: '打喷嚏，无咳嗽。', examination: '示例查体文字。', diagnosis: '鼻炎', symptoms: ['打喷嚏'], episodeId: 'episode-nose', version: 1 },
    { id: 'visit-4', personId: 'person-man', date: '2026-10-16', hospital: '示例儿童医院', doctor: '示例医生', chiefComplaint: '常规体检。', examination: '示例体检文字。', diagnosis: '健康体检', symptoms: [], episodeId: 'episode-exam', version: 1 }
  ];
  function doc(id, visit, kind, extra) {
    return {
      id, personId: visit.personId, kind, visitIds: [visit.id], files: [], status: 'confirmed', version: 1,
      createdBy: '家人（演示）', updatedAt: visit.date + 'T10:00:00+08:00',
      extracted: Object.assign({ patientName: persons.find(p => p.id === visit.personId).name, date: visit.date, hospital: visit.hospital, doctor: visit.doctor, chiefComplaint: '', examination: '', diagnosis: '', symptoms: [], items: [], findings: '', conclusion: '', medications: [], needsReview: [] }, extra || {})
    };
  }
  const documents = [
    doc('doc-1', visits[0], 'medical', { chiefComplaint: visits[0].chiefComplaint, examination: visits[0].examination, diagnosis: visits[0].diagnosis, symptoms: ['咳嗽'] }),
    doc('doc-2', visits[0], 'lab', { items: [{ name: '检验项目 A', value: '示例结果', unit: '', referenceRange: '见原报告', flag: '原报告标记偏高' }], conclusion: '示例检验记录，非真实报告。' }),
    doc('doc-3', visits[0], 'prescription', { medications: [{ name: '示例药品 A', specification: '待核对', dose: '', frequency: '', duration: '' }] }),
    doc('doc-4', visits[1], 'medical', { chiefComplaint: visits[1].chiefComplaint, diagnosis: visits[1].diagnosis, symptoms: ['咳嗽'] }),
    doc('doc-5', visits[2], 'medical', { chiefComplaint: visits[2].chiefComplaint, diagnosis: visits[2].diagnosis, symptoms: ['打喷嚏'] }),
    doc('doc-6', visits[3], 'medical', { chiefComplaint: visits[3].chiefComplaint, diagnosis: visits[3].diagnosis })
  ];
  documents[1].visitIds.push('visit-2');
  return {
    schemaVersion: 1, activePersonId: persons[0].id, persons, visits, documents,
    family: { name: '示例家庭', role: 'owner', members: [{ name: '我（演示）', role: 'owner' }, { name: '家人（演示）', role: 'member' }] },
    medications: [{ id: 'med-1', personId: 'person-he', documentId: 'doc-3', visitId: 'visit-1', name: '示例药品 A', specification: '待核对', dose: '', frequency: '', duration: '', startDate: '', stopDate: '', note: '', version: 1 }],
    audit: []
  };
};
