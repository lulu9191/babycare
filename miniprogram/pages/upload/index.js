const repository = require('../../services/repository');

const KIND_OPTIONS = [{ value: 'medical', label: '病历' }, { value: 'lab', label: '检查／检验单' }, { value: 'prescription', label: '处方／药品单' }];
const emptyDraft = (name) => ({ patientName: name || '', age: '', date: '', collectionDate: '', reportDate: '', prescriptionDate: '', hospital: '', department: '', doctor: '', chiefComplaint: '', examination: '', diagnosis: '', symptoms: [], items: [], findings: '', conclusion: '', medications: [], needsReview: [] });
const toast = (error) => wx.showToast({ title: error.message || '操作未完成，请重试', icon: 'none' });

Page({
  data: { mode: 'demo', person: null, kinds: KIND_OPTIONS, kind: 'medical', files: [], document: null, draft: emptyDraft(''), symptomsText: '', stage: 'select', visits: [], destinations: ['先保存资料，稍后关联', '新建一次就诊'], destinationIndex: 0, busy: false, error: '' },

  async onShow() {
    try {
      const boot = await repository.boot();
      const person = await repository.getActivePerson();
      const app = getApp();
      app.globalData = app.globalData || {};
      const visitId = app.globalData.uploadVisitId;
      const reviewId = app.globalData.reviewDocumentId;
      delete app.globalData.uploadVisitId;
      delete app.globalData.reviewDocumentId;
      if (!person) { this.setData({ person: null, mode: boot.mode, error: '请先添加一个健康档案。' }); return; }
      const changed = !this.data.person || person.id !== this.data.person.id;
      if (changed || visitId || reviewId) this.resetForm(person);
      this.setData({ person, mode: boot.mode, error: '' });
      await this.loadDestinations(person.id, visitId);
      if (reviewId) {
        const document = await repository.getDocument(reviewId);
        this.applyDocument(document);
        if (document.visitIds && document.visitIds.length) this.selectExisting(document.visitIds[0]);
      }
    } catch (error) { this.setData({ error: error.message || '暂时无法读取档案' }); }
  },

  resetForm(person) { this.setData({ person, files: [], document: null, kind: 'medical', draft: emptyDraft(person.name), symptomsText: '', stage: 'select', destinationIndex: 0, busy: false, error: '' }); },
  async loadDestinations(personId, preferredId) {
    const visits = await repository.listVisits({ personId, query: '', category: 'all' });
    this.setData({ visits, destinations: ['先保存资料，稍后关联', '新建一次就诊'].concat(visits.map((visit) => `${visit.date || '日期待确认'} · ${visit.diagnosis || visit.hospital || '就诊记录'}`)) });
    if (preferredId) this.selectExisting(preferredId);
  },
  selectExisting(id) { const index = this.data.visits.findIndex((visit) => visit.id === id); if (index >= 0) this.setData({ destinationIndex: index + 2 }); },
  selectKind(event) { if (this.data.document || this.data.busy) return; this.setData({ kind: event.currentTarget.dataset.kind }); },
  addPerson() { wx.navigateTo({ url: '/pages/person/index' }); },

  chooseImages() {
    if (this.data.busy || this.data.document) return;
    wx.chooseMedia({ count: Math.max(1, 9 - this.data.files.length), mediaType: ['image'], sourceType: ['album', 'camera'], success: (result) => {
      const files = result.tempFiles.map((file, index) => ({ path: file.tempFilePath, name: `照片 ${this.data.files.length + index + 1}`, type: 'image', size: file.size }));
      this.setData({ files: this.data.files.concat(files).slice(0, 9), error: '' });
    }, fail: (error) => { if (!/cancel/.test(error.errMsg || '')) toast(new Error('无法选择照片，请检查相机或相册权限。')); } });
  },
  choosePdf() {
    if (this.data.busy || this.data.document) return;
    wx.chooseMessageFile({ count: 1, type: 'file', extension: ['pdf'], success: (result) => {
      const file = result.tempFiles[0];
      if (!file || !/\.pdf$/i.test(file.name || '')) { toast(new Error('请选择 PDF 文件。')); return; }
      this.setData({ files: this.data.files.concat([{ path: file.path, name: file.name, type: 'pdf', size: file.size }]).slice(0, 9), error: '' });
    }, fail: (error) => { if (!/cancel/.test(error.errMsg || '')) toast(new Error('无法选择文件，请重试。')); } });
  },
  removeFile(event) { if (this.data.document || this.data.busy) return; this.setData({ files: this.data.files.filter((file, index) => index !== Number(event.currentTarget.dataset.index)) }); },
  async previewFile(event) {
    const file = this.data.files[Number(event.currentTarget.dataset.index)];
    try {
      const path = file.id ? await repository.getFileUrl(file) : file.path;
      if (!path) { toast(new Error('示例资料无原件，请自行添加演示照片。')); return; }
      if (file.type === 'pdf') {
        if (/^https?:/.test(path)) wx.downloadFile({ url: path, success: (result) => { if (result.statusCode === 200) wx.openDocument({ filePath: result.tempFilePath, fileType: 'pdf', showMenu: false, fail: () => toast(new Error('PDF 暂时无法打开')) }); else toast(new Error('PDF 下载失败')); }, fail: () => toast(new Error('PDF 下载失败')) });
        else wx.openDocument({ filePath: path, fileType: 'pdf', showMenu: false, fail: () => toast(new Error('PDF 暂时无法打开')) });
      } else wx.previewImage({ urls: [path], current: path });
    } catch (error) { toast(error); }
  },

  async prepare(recognize) {
    if (this.data.busy || !this.data.person) return;
    if (!this.data.files.length && !this.data.document) { toast(new Error('请先选择至少一张照片或一份 PDF。')); return; }
    this.setData({ busy: true, error: '' });
    try {
      let document = this.data.document;
      if (!document) {
        const visit = this.data.destinationIndex >= 2 ? this.data.visits[this.data.destinationIndex - 2] : null;
        document = await repository.uploadDocument({ personId: this.data.person.id, kind: this.data.kind, files: this.data.files, visitId: visit && visit.id });
        this.setData({ document, files: document.files });
      }
      if (recognize) document = await repository.recognizeDocument(document.id);
      this.applyDocument(document);
    } catch (error) { this.setData({ error: error.message || '未能整理资料；已保存的原件可以稍后继续。' }); }
    finally { this.setData({ busy: false }); }
  },
  recognize() { this.prepare(true); },
  manual() { this.prepare(false); },
  applyDocument(document) {
    const draft = Object.assign(emptyDraft(this.data.person.name), document.extracted || {});
    draft.items = draft.items || [];
    draft.medications = draft.medications || [];
    draft.needsReview = draft.needsReview || [];
    this.setData({ document, files: document.files || [], kind: document.kind, draft, symptomsText: (draft.symptoms || []).join('、'), stage: 'review' });
  },
  updateField(event) {
    const field = event.currentTarget.dataset.field;
    const allowed = ['patientName', 'age', 'date', 'collectionDate', 'reportDate', 'hospital', 'department', 'doctor', 'chiefComplaint', 'examination', 'diagnosis', 'findings', 'conclusion'];
    if (!allowed.includes(field)) return;
    this.setData({ [`draft.${field}`]: event.detail.value });
  },
  clearDate(event) { const field = event.currentTarget.dataset.field || 'date'; if (['date', 'collectionDate', 'reportDate'].includes(field)) this.setData({ [`draft.${field}`]: '' }); },
  updateSymptoms(event) { this.setData({ symptomsText: event.detail.value }); },
  updateItem(event) {
    const { group, index, field } = event.currentTarget.dataset;
    const allowed = group === 'items' ? ['name', 'value', 'unit', 'referenceRange', 'flag'] : ['name', 'specification', 'dose', 'frequency', 'duration'];
    if (!['items', 'medications'].includes(group) || !allowed.includes(field)) return;
    this.setData({ [`draft.${group}[${Number(index)}].${field}`]: event.detail.value });
  },
  addItem() { this.setData({ 'draft.items': this.data.draft.items.concat([{ name: '', value: '', unit: '', referenceRange: '', flag: '' }]) }); },
  addMedication() { this.setData({ 'draft.medications': this.data.draft.medications.concat([{ name: '', specification: '', dose: '', frequency: '', duration: '' }]) }); },
  removeRow(event) { const group = event.currentTarget.dataset.group; if (!['items', 'medications'].includes(group)) return; this.setData({ [`draft.${group}`]: this.data.draft[group].filter((row, index) => index !== Number(event.currentTarget.dataset.index)) }); },
  selectDestination(event) { this.setData({ destinationIndex: Number(event.detail.value) }); },
  async save() {
    if (this.data.busy || !this.data.document) return;
    const extracted = Object.assign({}, this.data.draft, { symptoms: this.data.symptomsText.split(/[，,、]/).map((item) => item.trim()).filter(Boolean) });
    if (this.data.kind === 'prescription') extracted.prescriptionDate = extracted.date;
    if (extracted.patientName.trim() !== this.data.person.name.trim()) { this.setData({ error: '单据姓名与当前档案不一致，请核对。不要将其他人的资料归入此档案。' }); return; }
    const selected = this.data.destinationIndex >= 2 ? this.data.visits[this.data.destinationIndex - 2] : null;
    this.setData({ busy: true, error: '' });
    try {
      const result = await repository.confirmDocument({ id: this.data.document.id, version: this.data.document.version, extracted, visitId: selected && selected.id, createVisit: this.data.destinationIndex === 1 });
      const url = result.visitId ? `/pages/visit/index?id=${encodeURIComponent(result.visitId)}` : `/pages/document/index?id=${encodeURIComponent(result.document.id)}`;
      this.resetForm(this.data.person);
      wx.navigateTo({ url });
    } catch (error) { this.setData({ error: error.message || '保存未完成，请核对内容后重试。' }); }
    finally { this.setData({ busy: false }); }
  },
  startAnother() {
    wx.showModal({ title: '重新选择资料', content: '已保存的原件仍保留在待整理资料中；当前未保存的核对修改将丢弃。', confirmText: '重新选择', success: (result) => { if (result.confirm) this.resetForm(this.data.person); } });
  },
  reloadDocument() {
    if (!this.data.document || this.data.busy) return;
    wx.showModal({ title: '重新读取资料', content: '当前未保存的核对修改将被已保存的内容替换。', confirmText: '重新读取', success: async (result) => {
      if (!result.confirm) return;
      try { const document = await repository.getDocument(this.data.document.id); this.applyDocument(document); this.setData({ error: '' }); }
      catch (error) { toast(error); }
    } });
  }
});
