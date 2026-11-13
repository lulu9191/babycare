const repository = require('../../services/repository');
const kinds = { medical: '病历', lab: '检查／检验单', prescription: '处方／药品单' };
const toast = (error) => wx.showToast({ title: error.message || '操作未完成', icon: 'none' });
Page({
  data: { mode: 'demo', person: null, document: null, kindLabel: '', extracted: {}, linkedVisits: [], choices: [], choiceLabels: [], selectedIndex: 0, loading: true, saving: false, error: '' },
  onLoad(options) { this.documentId = options.id; },
  async onShow() { await this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const boot = await repository.boot();
      const person = await repository.getActivePerson();
      const document = await repository.getDocument(this.documentId);
      const visits = await repository.listVisits({ personId: person.id, category: 'all', query: '' });
      const linkedVisits = visits.filter((visit) => (document.visitIds || []).includes(visit.id));
      const choices = visits.filter((visit) => !(document.visitIds || []).includes(visit.id));
      this.setData({ mode: boot.mode, person, document, kindLabel: kinds[document.kind] || '资料', extracted: document.extracted || {}, linkedVisits, choices, choiceLabels: choices.map((visit) => `${visit.date || '日期待确认'} · ${visit.diagnosis || visit.hospital || '就诊记录'}`), selectedIndex: 0 });
    } catch (error) { this.setData({ error: error.message || '资料暂时无法读取', document: null }); }
    finally { this.setData({ loading: false }); }
  },
  async preview(event) {
    const file = this.data.document.files[Number(event.currentTarget.dataset.index)];
    try {
      const path = await repository.getFileUrl(file);
      if (!path) { toast(new Error('示例资料无原件，请自行添加演示照片。')); return; }
      if (file.type === 'pdf' || /\.pdf$/i.test(file.name || '')) {
        const open = (localPath) => wx.openDocument({ filePath: localPath, fileType: 'pdf', showMenu: false, fail: () => toast(new Error('PDF 暂时无法打开')) });
        if (/^https?:/.test(path)) wx.downloadFile({ url: path, success: (result) => { if (result.statusCode === 200) open(result.tempFilePath); else toast(new Error('PDF 下载失败')); }, fail: () => toast(new Error('PDF 下载失败')) });
        else open(path);
      } else wx.previewImage({ current: path, urls: [path] });
    } catch (error) { toast(error); }
  },
  continueReview() { const app = getApp(); app.globalData = app.globalData || {}; app.globalData.reviewDocumentId = this.documentId; wx.switchTab({ url: '/pages/upload/index' }); },
  changeChoice(event) { this.setData({ selectedIndex: Number(event.detail.value) }); },
  async link() {
    if (this.data.saving) return;
    const selected = this.data.choices[this.data.selectedIndex];
    if (!selected) { toast(new Error('还没有可关联的就诊记录。')); return; }
    this.setData({ saving: true });
    try { await repository.linkDocument({ documentId: this.documentId, visitId: selected.id, version: this.data.document.version }); await this.load(); wx.showToast({ title: '已关联', icon: 'success' }); }
    catch (error) { toast(error); }
    finally { this.setData({ saving: false }); }
  },
  openVisit(event) { wx.navigateTo({ url: `/pages/visit/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` }); },
  goArchive() { wx.switchTab({ url: '/pages/archive/index' }); }
});
