export const getRedisURI = () => {
  if (process.env.NC_REDIS_URL) return process.env.NC_REDIS_URL;
  return `redis://${process.env.REDIS_HOST || 'localhost'}:${
    process.env.REDIS_PORT || '6379'
  }`;
};
