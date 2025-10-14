// todo: move to env
// defining at the top to override the default value in app.config.ts
process.env.NC_DASHBOARD_URL = process.env.NC_DASHBOARD_URL ?? '/';

import dns from 'node:dns';
import cluster from 'node:cluster';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import Noco from '~/Noco';
import { handleUncaughtErrors } from '~/utils';

handleUncaughtErrors(process);

// ref: https://github.com/nodejs/node/issues/40702#issuecomment-1103623246
dns.setDefaultResultOrder('ipv4first');

// Environment variables for cluster configuration
const NC_CLUSTER_ENABLED = process.env.NC_CLUSTER_ENABLED === 'true';
const NC_CLUSTER_WORKERS = parseInt(process.env.NC_CLUSTER_WORKERS || '0');
const NC_CLUSTER_HEALTH_CHECK_TIMEOUT =
  parseInt(process.env.NC_CLUSTER_HEALTH_CHECK_TIMEOUT) || 300000;
const PORT = parseInt(process.env.PORT) || 8080;

// Determine number of workers
const numCPUs = os.cpus().length;
const shouldUseCluster = NC_CLUSTER_ENABLED && numCPUs > 1;
const workerCount = NC_CLUSTER_WORKERS > 0 ? NC_CLUSTER_WORKERS : numCPUs;

// Signal handling state
let isShuttingDown = false;
let httpServer: http.Server | null = null;

async function createServer(isMaster: boolean): Promise<http.Server> {
  const server = express();
  server.enable('trust proxy');
  server.use(cors());

  // Add static file serving for the dashboard
  server.use(
    process.env.NC_DASHBOARD_URL ?? '/',
    express.static(path.join(__dirname, 'nc-gui')),
  );

  // if NC_DASHBOARD_URL is not set to /dashboard, then redirect '/dashboard'
  // to the path set in NC_DASHBOARD_URL
  if (!/^\/?dashboard\/?$/.test(process.env.NC_DASHBOARD_URL)) {
    server.use('/dashboard', (req, res) => {
      // Extract the original query parameters
      const originalQueryParams = new URLSearchParams(req.query as any);

      // Build the redirect URL without including the host
      const redirectUrl = `${process.env.NC_DASHBOARD_URL}${
        originalQueryParams.toString()
          ? '?' + originalQueryParams.toString()
          : ''
      }`;

      // Perform the redirect
      res.redirect(redirectUrl);
    });
  }

  server.set('view engine', 'ejs');

  return new Promise((resolve, reject) => {
    const serverInstance = server.listen(PORT, async () => {
      try {
        if (!isMaster) {
          console.log(`Worker ${process.pid} listening on port ${PORT}`);
        }

        server.use(await Noco.init({}, serverInstance, server));

        if (!isMaster) {
          console.log(`Worker ${process.pid} initialized successfully`);
        }

        httpServer = serverInstance;
        resolve(serverInstance);
      } catch (error) {
        reject(error);
      }
    });

    serverInstance.on('error', (error) => {
      reject(error);
    });
  });
}

async function gracefulShutdown(): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`Process ${process.pid} shutting down gracefully...`);

  if (httpServer) {
    return new Promise((resolve) => {
      httpServer!.close(() => {
        console.log(`Process ${process.pid} HTTP server closed`);
        resolve();
      });
    });
  }
}

function setupWorkerSignalHandlers(): void {
  const signals = ['SIGTERM', 'SIGINT', 'SIGHUP'] as const;

  signals.forEach((signal) => {
    process.on(signal, async () => {
      await gracefulShutdown();
      process.exit(0);
    });
  });
}

function setupPrimarySignalHandlers(): void {
  const signals = ['SIGTERM', 'SIGINT', 'SIGHUP'] as const;

  signals.forEach((signal) => {
    process.on(signal, async () => {
      if (isShuttingDown) {
        return;
      }

      isShuttingDown = true;
      console.log(
        `Primary ${process.pid} received ${signal}, shutting down gracefully...`,
      );

      // Get all active workers
      const workers = Object.values(cluster.workers || {}).filter(Boolean);

      if (workers.length === 0) {
        console.log('No workers to shutdown');
        process.exit(0);
        return;
      }

      console.log(`Shutting down ${workers.length} workers...`);

      // Send termination signal to all workers
      workers.forEach((worker) => {
        if (worker && !worker.isDead()) {
          worker.kill(signal);
        }
      });

      // Wait for workers to exit or force kill after timeout
      const shutdownTimeout = setTimeout(() => {
        console.log('Forcing shutdown of remaining workers...');
        workers.forEach((worker) => {
          if (worker && !worker.isDead()) {
            worker.kill('SIGKILL');
          }
        });
        process.exit(1);
      }, 10000); // 10 second timeout

      // Wait for all workers to exit
      let exitedWorkers = 0;
      const checkAllExited = () => {
        exitedWorkers++;
        if (exitedWorkers >= workers.length) {
          clearTimeout(shutdownTimeout);
          console.log('All workers exited gracefully');
          process.exit(0);
        }
      };

      workers.forEach((worker) => {
        if (worker) {
          worker.on('exit', checkAllExited);
        }
      });
    });
  });
}

async function healthCheck(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/api/v1/health',
      method: 'GET',
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            // Check if response has expected structure: {message: "OK", timestamp: ..., uptime: ...}
            resolve(
              response.message === 'OK' &&
                response.timestamp &&
                response.uptime !== undefined,
            );
          } catch (error) {
            resolve(false);
          }
        } else {
          resolve(false);
        }
      });
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function waitForMasterHealth(
  port: number,
  timeout: number,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await healthCheck(port)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return false;
}

if (shouldUseCluster) {
  if (cluster.isPrimary) {
    console.log(`Starting NocoDB in cluster mode with ${workerCount} workers`);
    console.log(`Primary process ${process.pid} is running`);

    // Setup signal handlers for primary process
    setupPrimarySignalHandlers();

    let masterWorkerReady = false;
    let readyWorkers = 0;
    let masterWorkerId: number | undefined;

    // Fork the first worker (master worker that will handle migrations)
    const masterWorker = cluster.fork({
      WORKER_ID: 'master',
      IS_MASTER_WORKER: 'true',
    });
    masterWorkerId = masterWorker.id;
    console.log(
      `Started master worker ${masterWorker.process.pid} (id: ${masterWorker.id})`,
    );

    // Wait for master worker to be healthy before starting others
    masterWorker.on('message', async (msg) => {
      if (msg === 'ready' && !masterWorkerReady) {
        masterWorkerReady = true;
        readyWorkers++;
        console.log(`Master worker ${masterWorker.process.pid} is ready`);

        // Wait for health check to pass
        console.log('Waiting for master worker health check...');
        const isHealthy = await waitForMasterHealth(
          PORT,
          NC_CLUSTER_HEALTH_CHECK_TIMEOUT,
        );

        if (isHealthy) {
          console.log(
            'Master worker is healthy, starting additional workers...',
          );

          // Start additional workers
          for (let i = 1; i < workerCount; i++) {
            const worker = cluster.fork({ WORKER_ID: `worker-${i}` });
            console.log(
              `Started worker ${worker.process.pid} (${i}/${workerCount - 1})`,
            );
          }
        } else {
          console.error(
            'Master worker failed health check, not starting additional workers',
          );
        }
      } else if (msg === 'ready') {
        readyWorkers++;
        console.log(`Worker ready (${readyWorkers}/${workerCount})`);
      }
    });

    cluster.on('exit', (worker, code, signal) => {
      if (isShuttingDown) {
        return;
      }

      console.log(
        `Worker ${worker.process.pid} died with code ${code} and signal ${signal}`,
      );
      console.log('Starting a new worker...');

      // Determine if this was the master worker
      const isMasterWorker = worker.id === masterWorkerId;

      if (isMasterWorker) {
        const newMasterWorker = cluster.fork({
          WORKER_ID: 'master',
          IS_MASTER_WORKER: 'true',
        });
        masterWorkerId = newMasterWorker.id;
        console.log(
          `Restarted master worker ${newMasterWorker.process.pid} (id: ${newMasterWorker.id})`,
        );
      } else {
        const newWorker = cluster.fork({ WORKER_ID: `worker-${Date.now()}` });
        console.log(
          `Restarted worker ${newWorker.process.pid} (id: ${newWorker.id})`,
        );
      }
    });
  } else {
    // Worker process
    console.log(`Worker ${process.pid} started (${process.env.WORKER_ID})`);

    // Setup signal handlers for worker processes
    setupWorkerSignalHandlers();

    (async () => {
      try {
        await createServer(false);

        // Notify master that this worker is ready
        if (process.send) {
          process.send('ready');
        }
      } catch (error) {
        console.error(`Worker ${process.pid} failed to start:`, error);
        process.exit(1);
      }
    })();
  }
} else {
  // Setup signal handlers for single process mode
  setupWorkerSignalHandlers();

  (async () => {
    try {
      await createServer(true);
      console.log(`App started successfully.\nVisit -> ${Noco.dashboardUrl}`);
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  })();
}
