import { Logger } from '@nestjs/common';
import { JOBS_QUEUE } from '../../interface/Jobs';

export const initTime = function () {
  return {
    hrTime: process.hrtime(),
  };
};

export const elapsedTime = function (
  time: { hrTime: [number, number] },
  label?: string,
  context?: string,
) {
  const elapsedS = process.hrtime(time.hrTime)[0].toFixed(3);
  const elapsedMs = process.hrtime(time.hrTime)[1] / 1000000;
  if (label)
    Logger.debug(
      `${label}: ${elapsedS}s ${elapsedMs}ms`,
      `${JOBS_QUEUE}${context ? `:${context}` : ''}`,
    );
  time.hrTime = process.hrtime();
};
