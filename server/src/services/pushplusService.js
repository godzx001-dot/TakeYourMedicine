import { env } from '../config/env.js';

export async function sendPushplusMessage({ title, content, template = 'html' }) {
  const payload = {
    token: env.pushplus.token,
    title,
    content,
    topic: env.pushplus.topic,
    template
  };

  const response = await fetch(env.pushplus.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || Number(data.code) !== 200) {
    const message = data?.msg || `pushplus request failed: ${response.status}`;
    throw new Error(message);
  }

  return data;
}
