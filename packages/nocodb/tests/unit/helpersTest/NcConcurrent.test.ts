import 'mocha';
import { expect } from 'chai';
import { NcConcurrent } from '~/utils/NcConcurrent';

const task = (index: number, willThrow?: boolean) => async () => {
  const delay = Math.floor(Math.random() * (50 - 10 + 1)) + 10;
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, delay);
  });
  if (willThrow) {
    throw new Error('Unexpected error at ' + index);
  }
  return [index, new Date().getTime()];
};

function NcConcurrentTests() {
  it(`will handle 10 concurrent processes`, async () => {
    const tasks = Array.from({ length: 10 }).map((_val, i) => task(i));
    const result = await NcConcurrent(tasks);

    // expect ordered result
    expect(result.map((r) => r[0]).join('_')).to.equal(
      Array.from({ length: 10 })
        .map((_val, i) => i)
        .join('_'),
    );
  });
  it(`will handle 10 concurrent processes with error`, async () => {
    const tasks = Array.from({ length: 10 }).map((_val, i) => task(i, i === 2));
    let isCatched = false;
    try {
      await NcConcurrent(tasks);
    } catch (ex: any) {
      expect(ex.message).to.eq('Unexpected error at 2');
      isCatched = true;
    }
    expect(isCatched).to.eq(true);
  });
}

export function NcConcurrentTest() {
  describe('NcConcurrentTest', NcConcurrentTests);
}
