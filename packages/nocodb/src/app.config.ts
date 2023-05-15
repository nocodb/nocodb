import type { AppConfig } from './interface/config';

const config: AppConfig = {
  throttler: {
    ttl: 60,
    max_apis: 10000,
    calc_execution_time: true,
  },
};

export default config;
