const repository = require('../../services/repository');
const kinds = { medical: '病历', lab: '检查／检验单', prescription: '处方／药品单' };
Page({
  data: { mode: 'demo', person: null, visit: null, documents: [], medications: [], labs: [], error: '', loading: true },
  onLoad(options) { this.visitId = options.id; },
  async onShow() {
    this.setData({ loading: true, error: '' });
    try {
      const boot = await repository.boot();
      const person = await repository.getActivePerson();
      const result = await repository.getVisit(this.visitId);
      const documents = result.documents.map((document) => Object.assign({}, document, { kindLabel: kinds[document.kind] || '资料', fileCount: (document.files || []).length, dateLabel: (document.extracted || {}).date || '日期待确认', isReference: document.visitIds && document.visitIds.length > 1 }));
      const medications = result.medications.map((medication) => Object.assign({}, medication, { usageLabel: [medication.startDate ? `开始 ${medication.startDate}` : '开始日期未记录', medication.stopDate ? `停止 ${medication.stopDate}` : '停止日期未记录'].join(' · ') }));
      this.setData({ mode: boot.mode, person, visit: result.visit, documents, medications, labs: documents.filter((document) => document.kind === 'lab') });
    } catch (error) { this.setData({ error: error.message || '无法读取这次就诊记录。', visit: null }); }
    finally { this.setData({ loading: false }); }
  },
  openDocument(event) { wx.navigateTo({ url: `/pages/document/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` }); },
  openMedication(event) { wx.navigateTo({ url: `/pages/medication/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` }); },
  addDocuments() { const app = getApp(); app.globalData = app.globalData || {}; app.globalData.uploadVisitId = this.visitId; wx.switchTab({ url: '/pages/upload/index' }); },
  goArchive() { wx.switchTab({ url: '/pages/archive/index' }); },
  retry() { this.onShow(); }
});
