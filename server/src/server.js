import express from 'express';
import router from './routes/index.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/response.js';
import { traceMiddleware } from './middleware/trace.js';
import { startReminderScheduler } from './services/reminderScheduler.js';

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(traceMiddleware);
app.use(router);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`[server] listening on :${env.port}`);
  startReminderScheduler();
});
