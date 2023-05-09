import type { AppConfig } from './interface/config';

const config: AppConfig = {
  throttler: {
    ttl: 60,
    max_apis: 600,
  },
};

export default config;
