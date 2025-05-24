import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import { psList } from '@heyikang/ps-list';

let openIDChildProcess: ChildProcess;
let samlChildProcess: ChildProcess;
export const startOpenIDIdp = async (env = {}) => {
  // kill any existing process which is running
  try {
    const processes = await psList();
    const p = processes.find(p => p.name === 'node' && p.cmd.startsWith('node oidc.js'));
    if (p) process.kill(p.pid);
  } catch (e) {
    console.log('Error killing openIDChildProcess', e);
  }

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

        // skip warning logs
        const lowerCaseLog = log.toLowerCase();
        if (lowerCaseLog.includes('npm') || lowerCaseLog.includes('debugger') || lowerCaseLog.includes('warning:'))
          return resolve(null);

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
    process.kill(-openIDChildProcess.pid);
  } catch (e) {
    console.log('Error killing openIDChildProcess', e);
  }
};

export const startSAMLIdp = async (env = {}) => {
  // kill any existing process which is running
  try {
    const processes = await psList();
    const p = processes.find(p => p.name === 'node' && p.cmd.startsWith('node saml.js'));
    if (p) process.kill(p.pid);
  } catch (e) {
    console.log('Error killing openIDChildProcess', e);
  }

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

      samlChildProcess.stdout.on('error', function (data) {
        console.log('error: ' + data.toString());
        reject(data.toString());
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
    process.kill(-samlChildProcess.pid);
  } catch (e) {
    console.log('Error killing openIDChildProcess', e);
  }
};
