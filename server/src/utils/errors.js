export class AppError extends Error {
  constructor({ message, status = 500, code = 50001, details }) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errorCodes = {
  validation: { status: 400, code: 40001, message: '参数校验失败' },
  emailInvalid: { status: 400, code: 40002, message: '邮箱格式非法' },
  unauthorized: { status: 401, code: 40101, message: '未登录或鉴权失败' },
  notFound: { status: 404, code: 40401, message: '资源不存在' },
  conflict: { status: 409, code: 40901, message: '状态冲突' },
  duplicate: { status: 409, code: 40003, message: '请求重复' }
};
