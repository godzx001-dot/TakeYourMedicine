import { AppError, errorCodes } from '../utils/errors.js';

export function authMiddleware(req, _res, next) {
  const openid = req.header('x-user-openid');

  if (!openid) {
    next(new AppError({ ...errorCodes.unauthorized }));
    return;
  }

  req.user = { openid };
  next();
}
