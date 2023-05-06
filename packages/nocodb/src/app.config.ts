export default {
  port: process.env.PORT || 3000,
  throttler: {
    ttl: 60,
    limit: 100,
  },
};
