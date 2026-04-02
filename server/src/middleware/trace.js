import crypto from 'crypto';

export function traceMiddleware(req, res, next) {
  const headerTraceId = req.headers['x-trace-id'];
  req.traceId = typeof headerTraceId === 'string' && headerTraceId.length > 0
    ? headerTraceId
    : crypto.randomBytes(8).toString('hex');
  res.setHeader('x-trace-id', req.traceId);
  next();
}
