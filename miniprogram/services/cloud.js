const config = require('../config');

module.exports = async function callCloud(action, payload) {
  if (!config.cloudEnv || typeof wx === 'undefined' || !wx.cloud) {
    throw new Error('微信云服务尚未配置，请先使用演示模式。');
  }
  let result;
  try {
    const response = await wx.cloud.callFunction({ name: config.cloudFunction, data: { action, payload } });
    result = response.result;
  } catch (_) {
    throw new Error('云服务尚未部署或暂不可用，操作没有保存。');
  }
  if (!result || result.ok !== true) {
    throw new Error(result && result.message || '云端操作未完成，请重试。');
  }
  return result.data;
};
