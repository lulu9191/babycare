const repository = require('../../services/repository');

function todayText() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

Page({
  data: { id:'', mode:'demo', name:'', birthDate:'', avatarPath:'', initial:'家', version:undefined,
    today:todayText(), loading:true, saving:false, error:'', isNew:true },
  onLoad(options) { this.setData({ id:options.id || '', isNew:!options.id }); this.load(); },
  async load() {
    this.setData({ loading:true, error:'' });
    try {
      const boot = await repository.boot();
      this.setData({ mode:boot.mode });
      if (this.data.id) {
        const person = boot.persons.find((p) => p.id === this.data.id);
        if (!person) throw new Error('没有找到这份健康档案');
        this.setData({ name:person.name, birthDate:person.birthDate || '', avatarPath:person.avatarPath || '',
          initial:(person.name || '家').slice(-1), version:person.version });
      }
    } catch (error) { this.setData({ error:error.message || '档案读取失败' }); }
    finally { this.setData({ loading:false }); }
  },
  onName(event) { this.setData({ name:event.detail.value, initial:(event.detail.value.trim() || '家').slice(-1) }); },
  onBirthDate(event) { this.setData({ birthDate:event.detail.value }); },
  clearBirthDate() { this.setData({ birthDate:'' }); },
  chooseAvatar() {
    if (this.data.saving) return;
    wx.chooseMedia({ count:1, mediaType:['image'], sourceType:['album','camera'], sizeType:['compressed'], success:(result) => {
      const file = result.tempFiles && result.tempFiles[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { wx.showToast({ title:'请选择小于5MB的头像', icon:'none' }); return; }
      this.setData({ avatarPath:file.tempFilePath });
    }, fail:(error) => { if (!/cancel/i.test(error.errMsg || '')) wx.showToast({ title:'无法读取照片，请检查相册权限', icon:'none' }); } });
  },
  async save() {
    if (this.data.saving || this.data.loading || this.data.error) return;
    const name = this.data.name.trim();
    if (!name) { wx.showToast({ title:'请填写档案名称', icon:'none' }); return; }
    if (this.data.birthDate && this.data.birthDate > this.data.today) { wx.showToast({ title:'出生日期不能晚于今天', icon:'none' }); return; }
    this.setData({ saving:true });
    try {
      const person = await repository.savePerson({ id:this.data.id || undefined, version:this.data.version,
        name, birthDate:this.data.birthDate, avatarPath:this.data.avatarPath });
      this.setData({ id:person.id, version:person.version, avatarPath:person.avatarPath || '', isNew:false });
      await repository.setActivePerson(person.id);
      wx.showToast({ title:'档案已保存', icon:'success' });
      wx.navigateBack({ delta:1, fail:() => wx.switchTab({ url:'/pages/profile/index' }) });
    } catch (error) { wx.showToast({ title:error.message || '保存失败，请重试', icon:'none' }); }
    finally { this.setData({ saving:false }); }
  },
  retry() { this.load(); }
});
