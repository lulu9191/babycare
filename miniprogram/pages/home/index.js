const repository = require('../../services/repository');

function displayPeople(persons, activeId) {
  return persons.map((person) => ({
    ...person,
    initial: (person.name || '家').slice(-1),
    chipClass: person.id === activeId ? 'person-chip active' : 'person-chip'
  }));
}

Page({
  data: {
    mode: 'demo', persons: [], person: null, activePersonId: '', loading: true,
    error: '', period: 'quarter', periods: [
      { value: 'recent', label: '最近30天' },
      { value: 'quarter', label: '本季度' },
      { value: 'year', label: '本年' }
    ], overview: null, recentVisits: []
  },

  onShow() { this.load(); },

  async load() {
    const request = (this._request || 0) + 1;
    this._request = request;
    this.setData({ loading: true, error: '' });
    try {
      const boot = await repository.boot();
      const person = boot.persons.find((item) => item.id === boot.activePersonId) || null;
      const overview = person ? await repository.getOverview(person.id, this.data.period) : null;
      if (request !== this._request) return;
      this.setData({
        mode: boot.mode,
        persons: displayPeople(boot.persons, boot.activePersonId),
        person, activePersonId: boot.activePersonId,
        overview,
        recentVisits: overview ? overview.recentVisits.map((visit) => ({
          ...visit, title: visit.diagnosis || visit.chiefComplaint || '就诊记录',
          dateText: visit.date || '日期待确认'
        })) : []
      });
    } catch (error) {
      if (request === this._request) this.setData({ error: error.message || '暂时无法读取档案，请重试' });
    } finally {
      if (request === this._request) this.setData({ loading: false });
    }
  },

  async changePerson(event) {
    if (event.currentTarget.dataset.id === this.data.activePersonId) return;
    try {
      await repository.setActivePerson(event.currentTarget.dataset.id);
      await this.load();
    } catch (error) { wx.showToast({ title: error.message || '切换失败', icon: 'none' }); }
  },

  changePeriod(event) { this.setData({ period: event.currentTarget.dataset.value }); this.load(); },
  addPerson() { wx.navigateTo({ url: '/pages/person/index' }); },
  openVisit(event) { wx.navigateTo({ url: '/pages/visit/index?id=' + encodeURIComponent(event.currentTarget.dataset.id) }); },
  openArchive() { wx.switchTab({ url: '/pages/archive/index' }); },
  openUpload() { wx.switchTab({ url: '/pages/upload/index' }); },
  retry() { this.load(); },
  onUnload() { this._request = (this._request || 0) + 1; }
});
