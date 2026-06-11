const { exec } = require('child_process');
const path = require('path');
const sdkPath = path.join(__dirname, '..', 'packages', 'nocodb-sdk');
const guiPath = path.join(__dirname, '..', 'packages', 'nc-gui');
const nocodbPath = path.join(__dirname, '..', 'packages', 'nocodb');

exec(`cd ${sdkPath} && pnpm i && npm run build`, (err, stdout, stderr) => {
    if (err) {
      console.error(`Error installing dependencies and building nocodb-sdk: ${err}`);
      return;
    }
    
    console.log(`Dependencies installed and nocodb-sdk built: ${stdout}`);

    const guiPromise = new Promise((resolve, reject) => {
      exec(`cd ${guiPath} && pnpm i ${sdkPath}`, (err, stdout, stderr) => {
        if (err) {
          reject(`Error installing dependencies for nc-gui: ${err}`);
        } else {
          resolve(`Dependencies installed for nc-gui: ${stdout}`);
        }
      });
    });
  
    const nocodbPromise = new Promise((resolve, reject) => {
      exec(`cd ${nocodbPath} && pnpm i ${sdkPath}`, (err, stdout, stderr) => {
        if (err) {
          reject(`Error installing dependencies for nocodb: ${err}`);
        } else {
          resolve(`Dependencies installed for nocodb: ${stdout}`);
        }
      });
    });

    Promise.all([guiPromise, nocodbPromise])
      .then((results) => {
        console.log(results.join('\n'));
      })
      .catch((err) => {
        console.error(err);
      });
  });