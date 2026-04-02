import { success } from '../middleware/response.js';
import { loginByCode, verifyProfileSignature } from '../services/wechatAuthService.js';
import { withTransaction } from '../db/pool.js';
import { createUser, findUserByOpenId } from '../repositories/userRepository.js';
import { AppError, errorCodes } from '../utils/errors.js';

export async function wechatLogin(req, res) {
  const { code } = req.body || {};
  if (!code) {
    throw new AppError({ ...errorCodes.validation, message: 'code 必填' });
  }

  const { openid } = await loginByCode(code);

  await withTransaction(async (connection) => {
    const user = await findUserByOpenId(connection, openid);
    if (!user) {
      await createUser(connection, openid);
    }
  });

  return success(res, { openid });
}

export async function verifyWechatProfile(req, res) {
  const { openid, rawData, signature, userInfo } = req.body || {};

  if (!openid || !rawData || !signature) {
    throw new AppError({ ...errorCodes.validation, message: 'openid/rawData/signature 必填' });
  }

  verifyProfileSignature({ openid, rawData, signature });

  return success(res, {
    openid,
    nickname: userInfo?.nickName || '',
    avatarUrl: userInfo?.avatarUrl || ''
  });
}
