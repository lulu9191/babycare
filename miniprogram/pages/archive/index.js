const repository = require('../../services/repository');
const { getRange } = require('./ranges');

const categories = [
  { value:'all', label:'全部内容' }, { value:'symptom', label:'明确存在的症状' },
  { value:'diagnosis', label:'诊断' }, { value:'lab', label:'检查结果' },
  { value:'medication', label:'处方药品' }
];
const types = [
  { value:'all', label:'全部时间' }, { value:'recent', label:'最近30天' },
  { value:'currentQuarter', label:'本季度' }, { value:'currentYear', label:'本年' },
  { value:'year', label:'按年份' }, { value:'month', label:'按年月' },
  { value:'quarter', label:'按季度' }, { value:'season', label:'按季节' }
];

Page({
  data: {
    mode:'demo', persons:[], activePersonId:'', person:null, visits:[], loading:true,
    error:'', query:'', categoryIndex:0, typeIndex:0, categories, types,
    years:[], yearIndex:0, months:Array.from({ length:12 }, (_, i) => (i + 1) + '月'),
    monthIndex:new Date().getMonth(), quarters:['第一季度','第二季度','第三季度','第四季度'],
    quarterIndex:Math.floor(new Date().getMonth() / 3), seasons:['春季 · 3—5月','夏季 · 6—8月','秋季 · 9—11月','冬季 · 12—次年2月'],
    seasonIndex:2, showYear:false, showMonth:false, showQuarter:false, showSeason:false,
    rangeLabel:'全部时间', shortcuts:['咳嗽','打喷嚏','急性支气管炎']
  },
  onLoad() {
    const year = new Date().getFullYear();
    this.setData({ years:Array.from({ length:30 }, (_, index) => String(year - index)) });
  },
  async onShow() {
    try {
      const boot = await repository.boot();
      if (this.data.activePersonId && boot.activePersonId !== this.data.activePersonId) this.resetFilters();
      this.setData({ mode:boot.mode, activePersonId:boot.activePersonId,
        person:boot.persons.find((p) => p.id === boot.activePersonId) || null,
        persons:boot.persons.map((p) => ({ ...p, initial:(p.name || '家').slice(-1), chipClass:p.id === boot.activePersonId ? 'person-chip active' : 'person-chip' })) });
      await this.search();
    } catch (error) { this.setData({ loading:false, error:error.message || '无法读取档案' }); }
  },
  resetFilters() { this.setData({ query:'', categoryIndex:0, typeIndex:0, showYear:false, showMonth:false, showQuarter:false, showSeason:false }); },
  async changePerson(event) {
    try { await repository.setActivePerson(event.currentTarget.dataset.id); this.resetFilters(); await this.onShow(); }
    catch (error) { wx.showToast({ title:error.message || '切换失败', icon:'none' }); }
  },
  onQueryInput(event) {
    this.setData({ query:event.detail.value });
    clearTimeout(this._debounce);
    this._debounce = setTimeout(() => this.search(), 250);
  },
  querySubmit() { clearTimeout(this._debounce); this.search(); },
  async search() {
    const request = (this._request || 0) + 1;
    this._request = request;
    const type = types[this.data.typeIndex].value;
    const range = getRange({ type, year:this.data.years[this.data.yearIndex], month:this.data.monthIndex + 1,
      quarter:this.data.quarterIndex + 1, season:['spring','summer','autumn','winter'][this.data.seasonIndex] });
    this.setData({ loading:true, error:'', rangeLabel:range.label });
    if (!this.data.activePersonId) { this.setData({ visits:[], loading:false }); return; }
    try {
      const visits = await repository.listVisits({ personId:this.data.activePersonId, query:this.data.query.trim(),
        category:categories[this.data.categoryIndex].value, start:range.start, end:range.end });
      if (request !== this._request) return;
      this.setData({ visits:visits.map((v) => ({ ...v, title:v.diagnosis || v.chiefComplaint || '就诊记录', dateText:v.date || '日期待确认' })) });
    } catch (error) { if (request === this._request) this.setData({ error:error.message || '检索失败，请重试', visits:[] }); }
    finally { if (request === this._request) this.setData({ loading:false }); }
  },
  onPicker(event) {
    const key = event.currentTarget.dataset.key;
    const permitted = ['categoryIndex','typeIndex','yearIndex','monthIndex','quarterIndex','seasonIndex'];
    if (permitted.indexOf(key) < 0) return;
    this.setData({ [key]:Number(event.detail.value) });
    if (key === 'typeIndex') {
      const type = types[this.data.typeIndex].value;
      this.setData({ showYear:['year','month','quarter','season'].indexOf(type) >= 0,
        showMonth:type === 'month', showQuarter:type === 'quarter', showSeason:type === 'season' });
    }
    this.search();
  },
  shortcut(event) { const query = event.currentTarget.dataset.query; this.setData({ query, categoryIndex:query === '急性支气管炎' ? 2 : 1 }); this.search(); },
  clear() { this.resetFilters(); this.search(); },
  openVisit(event) { wx.navigateTo({ url:'/pages/visit/index?id=' + encodeURIComponent(event.currentTarget.dataset.id) }); },
  addPerson() { wx.navigateTo({ url:'/pages/person/index' }); },
  onHide() { clearTimeout(this._debounce); },
  onUnload() { clearTimeout(this._debounce); this._request = (this._request || 0) + 1; }
});
