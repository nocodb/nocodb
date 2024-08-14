import debug from 'debug';
import { JOBS_QUEUE } from '~/interface/Jobs';

const debugLog = debug('nc:jobs:timings');

export const initTime = () => {
  return {
    hrTime: process.hrtime(),
  };
};

export const elapsedTime = (
  time: { hrTime: [number, number] },
  label?: string,
  context?: string,
) => {
  const elapsedS = process.hrtime(time.hrTime)[0].toFixed(3);
  const elapsedMs = process.hrtime(time.hrTime)[1] / 1000000;
  if (label)
    debugLog(
      `${label}: ${elapsedS}s ${elapsedMs}ms`,
      `${JOBS_QUEUE}${context ? `:${context}` : ''}`,
    );
  time.hrTime = process.hrtime();
};
