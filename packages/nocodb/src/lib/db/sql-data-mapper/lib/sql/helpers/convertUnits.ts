export function convertUnits(
  unit: string,
  langauge: 'mysql' | 'mssql' | 'pg' | 'sqlite'
) {
  switch (unit) {
    case 'milliseconds':
    case 'ms': {
      if (langauge === 'mssql') {
        return 'millisecond';
      }

      if (langauge === 'mysql') {
        return 'FRAC_SECOND';
      }

      if (langauge === 'pg') {
        return 'milliseconds';
      }

      if (langauge === 'sqlite') {
        return 'milliseconds';
      }

      return unit;
    }
    case 'seconds':
    case 's': {
      if (langauge === 'mssql' || langauge === 'pg') {
        return 'second';
      }

      if (langauge === 'mysql') {
        return 'SECOND';
      }

      if (langauge === 'sqlite') {
        return 'seconds';
      }

      return unit;
    }
    case 'minutes':
    case 'm': {
      if (langauge === 'mssql' || langauge === 'pg') {
        return 'minute';
      }

      if (langauge === 'mysql') {
        return 'MINUTE';
      }

      if (langauge === 'sqlite') {
        return 'minutes';
      }

      return unit;
    }
    case 'hours':
    case 'h': {
      if (langauge === 'mssql' || langauge === 'pg') {
        return 'hour';
      }

      if (langauge === 'mysql') {
        return 'HOUR';
      }

      if (langauge === 'sqlite') {
        return 'hours';
      }

      return unit;
    }
    case 'days':
    case 'd': {
      if (langauge === 'mssql' || langauge === 'pg') {
        return 'day';
      }

      if (langauge === 'mysql') {
        return 'DAY';
      }

      if (langauge === 'sqlite') {
        return 'days';
      }

      return unit;
    }
    case 'weeks':
    case 'w': {
      if (langauge === 'mssql' || langauge === 'pg') {
        return 'week';
      }

      if (langauge === 'mysql') {
        return 'WEEK';
      }

      if (langauge === 'sqlite') {
        return 'weeks';
      }

      return unit;
    }
    case 'months':
    case 'M': {
      if (langauge === 'mssql' || langauge === 'pg') {
        return 'month';
      }

      if (langauge === 'mysql') {
        return 'MONTH';
      }

      if (langauge === 'sqlite') {
        return 'months';
      }

      return unit;
    }
    case 'quarters':
    case 'Q': {
      if (langauge === 'mssql' || langauge === 'pg') {
        return 'quarter';
      }

      if (langauge === 'mysql') {
        return 'QUARTER';
      }

      if (langauge === 'sqlite') {
        return 'quarters';
      }

      return unit;
    }
    case 'years':
    case 'y': {
      if (langauge === 'mssql' || langauge === 'pg') {
        return 'year';
      }

      if (langauge === 'mysql') {
        return 'YEAR';
      }

      if (langauge === 'sqlite') {
        return 'years';
      }

      return unit;
    }
    default:
      return unit;
  }
}
