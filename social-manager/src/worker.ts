import 'dotenv/config';
import WorkerService from './services/worker.service';
import { behaviorEventsService } from './services/behavior-events.service';

// Enable Redis publishing so behavior events reach the HTTP server process
behaviorEventsService.initPublisher();

const CONCURRENCY = process.env.WORKER_CONCURRENCY
  ? parseInt(process.env.WORKER_CONCURRENCY)
  : 2;

console.log('===================================');
console.log('  Social Media Manager - Worker');
console.log('===================================');
console.log(`[worker] Starting worker process...`);
console.log(`[worker] Concurrency: ${CONCURRENCY}`);
console.log(`[worker] Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
console.log('===================================\n');

// Initialize worker
const workerService = new WorkerService(CONCURRENCY);

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n[worker] Received ${signal}, closing worker gracefully...`);
  await workerService.close();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.log('[worker] 🚀 Worker is running and waiting for jobs...\n');
