const config = require('./config');

App({
  globalData: { mode: config.mode, uploadVisitId: '', reviewDocumentId: '' },
  onLaunch() {
    if (config.mode === 'cloud' && config.cloudEnv && wx.cloud) {
      wx.cloud.init({ env: config.cloudEnv, traceUser: false });
    }
  }
});
