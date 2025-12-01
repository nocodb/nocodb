import debug from 'debug';
import { JOBS_QUEUE } from '~/interface/Jobs';

const debugLog = debug('nc:jobs:timings');

export type NocoHrTime = {
  hrTime: [number, number];
  totalHrTime: bigint;
};

export const initTime = () => {
  return {
    hrTime: process.hrtime(),
    totalHrTime: process.hrtime.bigint(),
  } as NocoHrTime;
};

export const elapsedTime = (
  time: NocoHrTime,
  label?: string,
  context?: string,
) => {
  const elapsedS = process.hrtime(time.hrTime)[0].toFixed(3);
  const elapsedMs = process.hrtime(time.hrTime)[1] / 1000000;

  const totalS =
    (process.hrtime.bigint() - time.totalHrTime) /
    BigInt(1000) /
    BigInt(1000) /
    BigInt(1000);

  if (label)
    debugLog(
      `${label}: ${elapsedS}s ${elapsedMs}ms; t=${totalS}s`,
      `${JOBS_QUEUE}${context ? `:${context}` : ''}`,
    );
  time.hrTime = process.hrtime();
};
