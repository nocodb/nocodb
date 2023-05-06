import type { AppConfig } from './interface/config';

const config: AppConfig = {
  throttler: {
    ttl: 10,
    max_apis: 10,
  },
};

export default config;
