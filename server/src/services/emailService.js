import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = nodemailer.createTransport({
  host: env.mail.host,
  port: env.mail.port,
  secure: env.mail.secure,
  auth: {
    user: env.mail.user,
    pass: env.mail.pass
  }
});

export async function sendDoseClickedEmail({ to, subject, html }) {
  const info = await transporter.sendMail({
    from: env.mail.from,
    to,
    subject,
    html
  });

  return info;
}
