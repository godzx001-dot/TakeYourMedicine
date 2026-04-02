import dotenv from 'dotenv';

dotenv.config();

const required = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'MAIL_FROM',
  'PUSHPLUS_TOKEN',
  'PUSHPLUS_TOPIC'
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONN_LIMIT || 10),
    queueLimit: 0,
    timezone: 'Z'
  },
  mail: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM
  },
  pushplus: {
    endpoint: process.env.PUSHPLUS_ENDPOINT || 'https://www.pushplus.plus/send',
    token: process.env.PUSHPLUS_TOKEN,
    topic: process.env.PUSHPLUS_TOPIC
  },
  wechat: {
    appId: process.env.WECHAT_APPID || '',
    appSecret: process.env.WECHAT_APPSECRET || ''
  },
  storage: {
    bucket: process.env.COS_BUCKET || '',
    region: process.env.COS_REGION || 'ap-shanghai'
  }
};
