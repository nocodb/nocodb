import { ChildProcess, execSync, spawn } from 'child_process';
import path from 'path';
import net from 'net';

let openIDChildProcess: ChildProcess;
let samlChildProcess: ChildProcess;

/**
 * Kill any process listening on the given port.
 * Uses lsof (macOS/Linux) — more reliable than matching by process name,
 * which broke on Node 24 where ESM changes the command string in `ps`.
 */
function killProcessOnPort(port: number) {
  try {
    // -t returns only PIDs; -i :port matches on that port; -sTCP:LISTEN limits to listeners only
    // Without -sTCP:LISTEN, lsof also returns client connections (e.g. the backend connecting
    // TO the IdP), which would kill the backend process.
    const pids = execSync(`lsof -t -i :${port} -sTCP:LISTEN`, { encoding: 'utf-8' }).trim();
    if (pids) {
      for (const pid of pids.split('\n')) {
        try {
          process.kill(Number(pid), 'SIGKILL');
        } catch {
          // already dead — ignore
        }
      }
    }
  } catch {
    // lsof exits non-zero when nothing is listening — that's fine
  }
}

/**
 * Wait until a port is free (nothing is listening).
 */
function waitForPortFree(port: number, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const socket = new net.Socket();
      socket.once('connect', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Port ${port} still in use after ${timeoutMs}ms`));
        } else {
          setTimeout(check, 200);
        }
      });
      socket.once('error', () => {
        // Connection refused → port is free
        socket.destroy();
        resolve();
      });
      socket.connect(port, '127.0.0.1');
    };
    check();
  });
}

export const startOpenIDIdp = async (env = {}) => {
  killProcessOnPort(4000);
  await waitForPortFree(4000);

  return new Promise((resolve, reject) => {
    try {
      openIDChildProcess = spawn('bash', ['-c', 'npm install && npm start'], {
        cwd: path.join(__dirname, '../../../../../scripts/ee/playwright/openid-provider'),
        env: {
          ...process.env,
          ...env,
        },
        detached: true,
      });

      openIDChildProcess.stdout.on('data', function (data) {
        const log = data.toString();
        console.log(log);
        if (log.includes('oidc-provider listening on port 4000')) resolve(null);
      });

      openIDChildProcess.stderr.on('data', function (data) {
        const log = data.toString();
        console.log(log);

        // skip warning logs (npm warn, debugger, deprecation warnings, etc.)
        const lowerCaseLog = log.toLowerCase();
        if (
          lowerCaseLog.includes('npm') ||
          lowerCaseLog.includes('debugger') ||
          lowerCaseLog.includes('warn') ||
          lowerCaseLog.includes('deprecat')
        )
          return;

        reject(log);
      });

      // set a timeout to reject promise if not resolved
      setTimeout(() => {
        reject('timeout');
      }, 20000);
    } catch (e) {
      console.log(e);
    }
  });
};

export const stopOpenIDIdp = async () => {
  try {
    if (openIDChildProcess?.pid && !openIDChildProcess.killed) {
      openIDChildProcess.kill('SIGTERM');
    }
  } catch (e) {
    console.log('Error killing openIDChildProcess', e);
  }
  killProcessOnPort(4000);
};

export const startSAMLIdp = async (env = {}) => {
  killProcessOnPort(7000);
  await waitForPortFree(7000);

  return new Promise((resolve, reject) => {
    try {
      samlChildProcess = spawn('npm', ['start'], {
        cwd: path.join(__dirname, '../../../../../scripts/ee/playwright/saml-provider'),
        env: {
          ...process.env,
          ...env,
        },
        detached: true,
      });

      samlChildProcess.stdout.on('data', function (data) {
        const log = data.toString();
        console.log(log);
        if (log.includes('IdP server ready at')) resolve(null);
      });

      samlChildProcess.stderr.on('data', function (data) {
        const log = data.toString();
        console.log(log);

        // skip warning logs (npm warn, debugger, deprecation warnings, etc.)
        const lowerCaseLog = log.toLowerCase();
        if (
          lowerCaseLog.includes('npm') ||
          lowerCaseLog.includes('debugger') ||
          lowerCaseLog.includes('warn') ||
          lowerCaseLog.includes('deprecat')
        )
          return;

        reject(log);
      });

      // set a timeout to reject promise if not resolved
      setTimeout(() => {
        reject('timeout');
      }, 10000);
    } catch (e) {
      console.log(e);
    }
  });
};

export const stopSAMLIpd = async () => {
  try {
    if (samlChildProcess?.pid && !samlChildProcess.killed) {
      samlChildProcess.kill('SIGTERM');
    }
  } catch (e) {
    console.log('Error killing samlChildProcess', e);
  }
  killProcessOnPort(7000);
};
