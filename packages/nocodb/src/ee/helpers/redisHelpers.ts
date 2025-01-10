import {
  NC_REDIS_GRACE_TTL,
  NC_REDIS_TTL,
  NC_REDIS_TYPE,
} from 'src/helpers/redisHelpers';

export { NC_REDIS_TYPE, NC_REDIS_TTL, NC_REDIS_GRACE_TTL };

export const throttlerEnabled = () =>
  !!(process.env.NC_THROTTLER_REDIS || process.env.NC_REDIS_URL);

export const getRedisURL = (type?: NC_REDIS_TYPE) => {
  if (!process.env.NC_REDIS_URL) return undefined;

  switch (type) {
    case NC_REDIS_TYPE.CACHE:
      return process.env.NC_REDIS_URL;
    case NC_REDIS_TYPE.JOB:
      return process.env.NC_REDIS_JOB_URL || process.env.NC_REDIS_URL;
    case NC_REDIS_TYPE.THROTTLER:
      return process.env.NC_THROTTLER_REDIS || process.env.NC_REDIS_URL;
    default:
      return process.env.NC_REDIS_URL;
  }
};
