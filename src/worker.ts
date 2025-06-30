import server from './_worker.js';
import cron from './cron-worker';

export default {
  fetch: server.fetch,
  scheduled: cron.scheduled,
};
