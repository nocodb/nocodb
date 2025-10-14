import * as Sentry from '@sentry/node';
import { packageInfo } from '~/utils/packageVersion';

if (process.env.NC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NC_SENTRY_DSN,
    debug: false,
    environment: process.env.NODE_ENV,
    release: packageInfo.version,
  });
}
