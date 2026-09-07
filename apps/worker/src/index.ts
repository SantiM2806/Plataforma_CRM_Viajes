import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { refreshTrm } from './trm';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const QUEUE = 'travelkit-jobs';

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

async function main() {
  const queue = new Queue(QUEUE, { connection });

  // Job repetible: refrescar la TRM cada día a las 07:00 (hora del servidor).
  await queue.add(
    'trm-refresh',
    {},
    { repeat: { pattern: '0 7 * * *' }, jobId: 'trm-refresh-daily' },
  );
  // Y una vez al arrancar, para no quedar sin TRM.
  await queue.add('trm-refresh', {}, { removeOnComplete: true, removeOnFail: true });

  const worker = new Worker(
    QUEUE,
    async (job: Job) => {
      switch (job.name) {
        case 'trm-refresh': {
          const r = await refreshTrm();
          console.log(`[trm] ${r.rateDate} = ${r.rate} COP/USD`);
          return r;
        }
        default:
          console.warn('[worker] job desconocido:', job.name);
      }
    },
    { connection },
  );

  worker.on('completed', (job) => console.log('[worker] completado:', job.name));
  worker.on('failed', (job, err) => console.error('[worker] falló:', job?.name, err?.message));

  console.log(`[worker] escuchando cola "${QUEUE}" en ${REDIS_URL}`);

  const shutdown = async () => {
    console.log('[worker] cerrando…');
    await worker.close();
    await queue.close();
    await connection.quit();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('[worker] error fatal:', e);
  process.exit(1);
});
