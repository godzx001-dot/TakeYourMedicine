import { z } from 'zod';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emailItemSchema = z.string().trim().regex(emailRegex, '邮箱格式非法');

function normalizeEmails(input) {
  const list = Array.isArray(input?.emails)
    ? input.emails
    : (input?.email ? [input.email] : []);

  const normalized = list
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

const medicineEventBaseSchema = z.object({
  email: z.string().trim().regex(emailRegex, '邮箱格式非法').optional(),
  emails: z.array(emailItemSchema).min(1).max(10).optional(),
  clickedAt: z.string().datetime(),
  source: z.string().min(1),
  nickname: z.string().trim().max(64).optional(),
  avatarUrl: z.string().trim().url().optional(),
  doseTypeCode: z.enum(['AM', 'MID', 'NIGHT']).optional(),
  clientRequestId: z.string().uuid().optional()
});

export function parseMedicineEventPayload(payload) {
  const input = medicineEventBaseSchema.parse(payload);
  const emails = normalizeEmails(input);
  if (emails.length === 0) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['emails'],
        message: '请至少提供一个通知邮箱'
      }
    ]);
  }
  return { ...input, emails };
}

const notificationEmailBaseSchema = z.object({
  email: z.string().trim().regex(emailRegex, '邮箱格式非法').optional(),
  emails: z.array(emailItemSchema).min(1).max(10).optional(),
  isActive: z.boolean().optional()
});

export function parseNotificationEmailPayload(payload) {
  const input = notificationEmailBaseSchema.parse(payload);
  const emails = normalizeEmails(input);
  if (emails.length === 0) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['emails'],
        message: '请至少提供一个通知邮箱'
      }
    ]);
  }
  return {
    emails,
    isActive: input.isActive ?? true
  };
}

export const todaySlotsQuerySchema = z.object({
  timezone: z.string().optional().default('Asia/Shanghai')
});
