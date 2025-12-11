import type { AppConfig } from './interface/config';
import { isEE } from '~/utils';

const config: AppConfig = {
  throttler: {
    calc_execution_time: false,
    data: {
      ttl: parseInt(process.env.NC_THROTTLER_DATA_TTL) || 60,
      max_apis: parseInt(process.env.NC_THROTTLER_DATA_LIMIT) || 100,
      block_duration: parseInt(process.env.NC_THROTTLER_DATA_BLOCK) || 60,
    },
    meta: {
      ttl: parseInt(process.env.NC_THROTTLER_META_TTL) || 60,
      max_apis: parseInt(process.env.NC_THROTTLER_META_LIMIT) || 50,
      block_duration: parseInt(process.env.NC_THROTTLER_META_BLOCK) || 60,
    },
    public: {
      ttl: parseInt(process.env.NC_THROTTLER_PUBLIC_TTL) || 60,
      max_apis: parseInt(process.env.NC_THROTTLER_PUBLIC_LIMIT) || 10,
      block_duration: parseInt(process.env.NC_THROTTLER_PUBLIC_BLOCK) || 300,
    },
  },
  basicAuth: {
    username: process.env.NC_HTTP_BASIC_USER ?? 'defaultusername',
    password: process.env.NC_HTTP_BASIC_PASS ?? 'defaultpassword',
  },
  auth: {
    emailPattern:
      process.env.NC_EMAIL_PATTERN && new RegExp(process.env.NC_EMAIL_PATTERN),
    disableEmailAuth: !!process.env.NC_DISABLE_EMAIL_AUTH,
  },
  mainSubDomain: process.env.NC_MAIN_SUBDOMAIN ?? 'app',
  dashboardPath: process.env.NC_DASHBOARD_URL ?? (isEE ? '/' : '/dashboard'),
};

export default config;
