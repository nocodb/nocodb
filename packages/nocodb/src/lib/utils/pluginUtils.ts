import fs from 'fs';

export async function waitForStreamClose(
  stream: fs.WriteStream
): Promise<void> {
  return new Promise((resolve, reject) => {
    stream
      .once('finish', () => {
        resolve();
      })
      .once('error', () => {
        reject();
      });
    stream.end();
  });
}
