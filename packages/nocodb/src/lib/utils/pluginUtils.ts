import fs from 'fs';

export async function waitForStreamClose(
  stream: fs.WriteStream
): Promise<void> {
  stream.end();
  return new Promise((resolve) => {
    stream.once('finish', () => {
      resolve();
    });
  });
}
