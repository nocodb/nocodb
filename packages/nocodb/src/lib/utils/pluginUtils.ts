import fs from 'fs';
import path from 'path';
import os from 'os';

export function generateTempFilePath() {
  return path.join(os.tmpdir(), 'temp.txt');
}

export async function waitForStreamClose(
  stream: fs.WriteStream
): Promise<void> {
  return new Promise((resolve, reject) => {
    stream
      .once('finish', () => {
        resolve();
      })
      .once('error', (err) => {
        reject(err);
      });
    stream.end();
  });
}
