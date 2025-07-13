import { initLogger, logEvent, logError } from './utils/logger';
import { generateAndPublish } from './modules/generateAndPublish';

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    initLogger(env.pseudointelekt_logs_db, ctx, env.WORKER_ID);
    logEvent({ type: 'cron-start', time: event.scheduledTime });
    try {
      const { article, slug } = await generateAndPublish(env);
      logEvent({ type: 'cron-complete', title: article.title, slug });
    } catch (err) {
      logError(err, { type: 'cron-error' });
      throw err;
    }
  },
};
