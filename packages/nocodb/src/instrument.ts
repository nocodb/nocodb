import * as Sentry from '@sentry/node';
import { packageInfo } from '~/utils/packageVersion';
import { allowErrorExport, redactSqlLiterals } from '~/utils/errorRedaction';

if (process.env.NC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NC_SENTRY_DSN,
    debug: false,
    environment: process.env.NODE_ENV,
    release: packageInfo.version,
    beforeSend: (event) => {
      for (const exception of event.exception?.values ?? []) {
        exception.value = redactSqlLiterals(exception.value);
      }
      event.message = redactSqlLiterals(event.message);

      const signature =
        event.exception?.values?.map((e) => `${e.type}:${e.value}`).join('|') ??
        event.message ??
        '';

      return allowErrorExport(signature) ? event : null;
    },
  });
}
