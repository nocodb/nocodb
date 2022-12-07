export function convertUnits(
  unit: string,
  type: 'mysql' | 'mssql' | 'pg' | 'sqlite'
) {
  switch (unit) {
    case 'milliseconds':
    case 'ms': {
      if (type === 'mssql') {
        return 'millisecond';
      }

      if (type === 'mysql') {
        // MySQL doesn't support millisecond
        // hence change from MICROSECOND to millisecond manually
        return 'MICROSECOND';
      }

      if (type === 'pg' || type === 'sqlite') {
        return 'milliseconds';
      }

      return unit;
    }
    case 'seconds':
    case 's': {
      if (type === 'mssql' || type === 'pg') {
        return 'second';
      }

      if (type === 'mysql') {
        return 'SECOND';
      }

      if (type === 'sqlite') {
        return 'seconds';
      }

      return unit;
    }
    case 'minutes':
    case 'm': {
      if (type === 'mssql' || type === 'pg') {
        return 'minute';
      }

      if (type === 'mysql') {
        return 'MINUTE';
      }

      if (type === 'sqlite') {
        return 'minutes';
      }

      return unit;
    }
    case 'hours':
    case 'h': {
      if (type === 'mssql' || type === 'pg') {
        return 'hour';
      }

      if (type === 'mysql') {
        return 'HOUR';
      }

      if (type === 'sqlite') {
        return 'hours';
      }

      return unit;
    }
    case 'days':
    case 'd': {
      if (type === 'mssql' || type === 'pg') {
        return 'day';
      }

      if (type === 'mysql') {
        return 'DAY';
      }

      if (type === 'sqlite') {
        return 'days';
      }

      return unit;
    }
    case 'weeks':
    case 'w': {
      if (type === 'mssql' || type === 'pg') {
        return 'week';
      }

      if (type === 'mysql') {
        return 'WEEK';
      }

      if (type === 'sqlite') {
        return 'weeks';
      }

      return unit;
    }
    case 'months':
    case 'M': {
      if (type === 'mssql' || type === 'pg') {
        return 'month';
      }

      if (type === 'mysql') {
        return 'MONTH';
      }

      if (type === 'sqlite') {
        return 'months';
      }

      return unit;
    }
    case 'quarters':
    case 'Q': {
      if (type === 'mssql' || type === 'pg') {
        return 'quarter';
      }

      if (type === 'mysql') {
        return 'QUARTER';
      }

      if (type === 'sqlite') {
        return 'quarters';
      }

      return unit;
    }
    case 'years':
    case 'y': {
      if (type === 'mssql' || type === 'pg') {
        return 'year';
      }

      if (type === 'mysql') {
        return 'YEAR';
      }

      if (type === 'sqlite') {
        return 'years';
      }

      return unit;
    }
    default:
      return unit;
  }
}
