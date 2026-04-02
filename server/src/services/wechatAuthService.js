import crypto from 'crypto';
import { AppError, errorCodes } from '../utils/errors.js';
import { env } from '../config/env.js';

const sessionStore = new Map();
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

function assertWechatConfig() {
  if (!env.wechat?.appId || !env.wechat?.appSecret) {
    throw new AppError({ status: 500, code: 50002, message: '缺少微信登录配置（WECHAT_APPID/WECHAT_APPSECRET）' });
  }
}

export async function loginByCode(code) {
  assertWechatConfig();

  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(env.wechat.appId)}&secret=${encodeURIComponent(env.wechat.appSecret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
  const resp = await fetch(url);
  const data = await resp.json();

  if (!resp.ok || data?.errcode) {
    throw new AppError({ ...errorCodes.validation, message: data?.errmsg || '微信登录失败' });
  }

  const openid = data.openid;
  const sessionKey = data.session_key;

  sessionStore.set(openid, {
    sessionKey,
    expiresAt: Date.now() + SESSION_TTL_MS
  });

  return { openid };
}

export function verifyProfileSignature({ openid, rawData, signature }) {
  const cached = sessionStore.get(openid);
  if (!cached || cached.expiresAt < Date.now()) {
    sessionStore.delete(openid);
    throw new AppError({ ...errorCodes.unauthorized, message: '会话已过期，请重新登录' });
  }

  const sign = crypto.createHash('sha1').update(`${rawData}${cached.sessionKey}`).digest('hex');
  if (sign !== signature) {
    throw new AppError({ ...errorCodes.validation, message: '用户信息签名校验失败' });
  }

  return true;
}
