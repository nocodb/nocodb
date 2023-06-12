// return a middleware to set cache-control header
// default period is 30 days
export const getCacheMiddleware = (period: string | number = 2592000) => {
  return async (req, res, next) => {
    const { method } = req;
    // only cache GET requests
    if (method === 'GET') {
      // set cache-control header
      res.set('Cache-Control', `public, max-age=${period}`);
    }
    next();
  };
};
