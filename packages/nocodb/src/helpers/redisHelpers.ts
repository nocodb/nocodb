export enum NC_REDIS_TYPE {
  CACHE = 'CACHE',
  JOB = 'JOB',
  THROTTLER = 'THROTTLER',
}

export const NC_REDIS_TTL = +process.env.NC_REDIS_TTL || 60 * 60 * 24 * 3; // 3 days
export const NC_REDIS_GRACE_TTL =
  +process.env.NC_REDIS_GRACE_TTL || 60 * 60 * 24 * 1; // 1 day

export const getRedisURL = (type?: NC_REDIS_TYPE) => {
  switch (type) {
    case NC_REDIS_TYPE.CACHE:
      return process.env.NC_REDIS_URL;
    case NC_REDIS_TYPE.JOB:
      return process.env.NC_REDIS_JOB_URL;
    case NC_REDIS_TYPE.THROTTLER:
      return process.env.NC_THROTTLER_REDIS;
    default:
      return process.env.NC_REDIS_URL;
  }
};
