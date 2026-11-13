const repository = require('../../services/repository');

const kinds = { medical:'病历', lab:'检查／检验单', prescription:'处方' };
const statuses = { uploaded:'待识别', review:'待核对', confirmed:'待关联' };
const roles = { owner:'管理员', admin:'管理员', member:'共同维护', editor:'共同维护' };

Page({
  data: { mode:'demo', loading:true, error:'', person:null, persons:[], family:null, members:[], pending:[] },
  onShow() { this.load(); },
  async load() {
    const request = (this._request || 0) + 1;
    this._request = request;
    this.setData({ loading:true, error:'' });
    try {
      const boot = await repository.boot();
      const family = await repository.getFamily();
      const person = boot.persons.find((p) => p.id === boot.activePersonId) || null;
      const documents = person ? await repository.listDocuments(person.id) : [];
      const pending = documents.filter((doc) => doc.status !== 'confirmed' || doc.visitIds.length === 0);
      if (request !== this._request) return;
      this.setData({
        mode:boot.mode, person, family,
        persons:boot.persons.map((p) => ({ ...p, initial:(p.name || '家').slice(-1), current:p.id === boot.activePersonId })),
        members:(family.members || []).map((member, index) => ({ ...member, key:String(index), roleLabel:roles[member.role] || '家庭成员' })),
        pending:pending.map((doc) => ({ ...doc, kindLabel:kinds[doc.kind] || '医疗资料', statusLabel:statuses[doc.status] || '待整理', dateText:doc.extracted && doc.extracted.date ? doc.extracted.date : '日期待确认' }))
      });
    } catch (error) { if (request === this._request) this.setData({ error:error.message || '暂时无法读取资料' }); }
    finally { if (request === this._request) this.setData({ loading:false }); }
  },
  editPerson(event) { wx.navigateTo({ url:'/pages/person/index?id=' + encodeURIComponent(event.currentTarget.dataset.id) }); },
  addPerson() { wx.navigateTo({ url:'/pages/person/index' }); },
  async switchPerson(event) {
    try { await repository.setActivePerson(event.currentTarget.dataset.id); await this.load(); }
    catch (error) { wx.showToast({ title:error.message || '切换失败', icon:'none' }); }
  },
  openDocument(event) { wx.navigateTo({ url:'/pages/document/index?id=' + encodeURIComponent(event.currentTarget.dataset.id) }); },
  showInviteInfo() {
    wx.showModal({ title:'家庭共同维护', content:'邀请成员将在微信登录和云服务接入后启用。当前本机演示不会创建真实邀请码，也不会将资料分享给他人。', showCancel:false, confirmText:'知道了' });
  },
  resetDemo() {
    if (this.data.mode !== 'demo') return;
    wx.showModal({ title:'重置本机演示', content:'将删除本机演示中新增或修改的档案记录，清理本程序保存的原件副本及头像，并恢复示例数据。不会删除相册原图或影响其他设备。', confirmText:'重置演示', confirmColor:'#9B463B', success:async (result) => {
      if (!result.confirm) return;
      try { await repository.resetDemo(); await this.load(); wx.showToast({ title:'已恢复示例数据', icon:'success' }); }
      catch (error) { wx.showToast({ title:error.message || '重置失败', icon:'none' }); }
    } });
  },
  retry() { this.load(); },
  onUnload() { this._request = (this._request || 0) + 1; }
});
