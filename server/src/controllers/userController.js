import { success } from '../middleware/response.js';
import { getMyNotificationEmail, updateMyNotificationEmail } from '../services/userService.js';

export async function fetchNotificationEmail(req, res) {
  const result = await getMyNotificationEmail(req.user.openid);
  return success(res, result);
}

export async function updateNotificationEmail(req, res) {
  const result = await updateMyNotificationEmail(req.user.openid, req.body);
  return success(res, result);
}
