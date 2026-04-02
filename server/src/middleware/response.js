import { AppError } from '../utils/errors.js';

export function success(res, data = {}, message = 'ok') {
  return res.json({
    code: 0,
    message,
    data,
    traceId: res.getHeader('x-trace-id')
  });
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      code: err.code,
      message: err.message,
      data: err.details || null,
      traceId: req.traceId
    });
  }

  console.error('[UNHANDLED_ERROR]', req.traceId, err);
  return res.status(500).json({
    code: 50001,
    message: '系统异常',
    data: null,
    traceId: req.traceId
  });
}
