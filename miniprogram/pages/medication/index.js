const repository = require('../../services/repository');
Page({
  data: { mode: 'demo', person: null, medication: null, startDate: '', stopDate: '', note: '', loading: true, saving: false, error: '' },
  onLoad(options) { this.medicationId = options.id; this.loaded = false; },
  async onShow() {
    try {
      const person = await repository.getActivePerson();
      if (this.loaded && this.data.medication && person && this.data.medication.personId === person.id) return;
      const boot = await repository.boot();
      const medication = await repository.getMedication(this.medicationId);
      this.setData({ mode: boot.mode, person, medication, startDate: medication.startDate || '', stopDate: medication.stopDate || '', note: medication.note || '', loading: false, error: '' });
      this.loaded = true;
    } catch (error) { this.setData({ loading: false, medication: null, error: error.message || '无法读取用药记录' }); }
  },
  updateDate(event) { const field = event.currentTarget.dataset.field; if (field === 'startDate' || field === 'stopDate') this.setData({ [field]: event.detail.value }); },
  clearDate(event) { const field = event.currentTarget.dataset.field; if (field === 'startDate' || field === 'stopDate') this.setData({ [field]: '' }); },
  updateNote(event) { this.setData({ note: event.detail.value }); },
  viewPrescription() { wx.navigateTo({ url: `/pages/document/index?id=${encodeURIComponent(this.data.medication.documentId)}` }); },
  async save() {
    if (this.data.saving || !this.data.medication) return;
    const { startDate, stopDate, note, medication } = this.data;
    if (startDate && stopDate && stopDate < startDate) { this.setData({ error: '停止日期不能早于开始日期，请核对。' }); return; }
    this.setData({ saving: true, error: '' });
    try {
      const updated = await repository.updateMedication({ id: medication.id, version: medication.version, startDate, stopDate, note });
      this.setData({ medication: updated });
      wx.showToast({ title: this.data.mode === 'demo' ? '已保存到本机' : '已保存', icon: 'success' });
    } catch (error) { this.setData({ error: error.message || '保存失败，请稍后重试。' }); }
    finally { this.setData({ saving: false }); }
  },
  retry() { this.loaded = false; this.onShow(); },
  goArchive() { wx.switchTab({ url: '/pages/archive/index' }); }
});
