export function convertUnits(
  unit: string,
  type: 'mysql' | 'pg' | 'sqlite' | 'mssql',
) {
  switch (unit) {
    case 'milliseconds':
    case 'ms': {
      switch (type) {
        case 'mysql':
          // MySQL doesn't support millisecond
          // hence change from MICROSECOND to millisecond manually
          return 'MICROSECOND';
        case 'pg':
        case 'sqlite':
          return 'milliseconds';
        case 'mssql':
          return 'millisecond';
        default:
          return unit;
      }
    }
    case 'seconds':
    case 's': {
      switch (type) {
        case 'pg':
          return 'second';
        case 'mysql':
          return 'SECOND';
        case 'sqlite':
          return 'seconds';
        case 'mssql':
          return 'second';
        default:
          return unit;
      }
    }
    case 'minutes':
    case 'm': {
      switch (type) {
        case 'pg':
          return 'minute';
        case 'mysql':
          return 'MINUTE';
        case 'sqlite':
          return 'minutes';
        case 'mssql':
          return 'minute';
        default:
          return unit;
      }
    }
    case 'hours':
    case 'h': {
      switch (type) {
        case 'pg':
          return 'hour';
        case 'mysql':
          return 'HOUR';
        case 'sqlite':
          return 'hours';
        case 'mssql':
          return 'hour';
        default:
          return unit;
      }
    }
    case 'days':
    case 'd': {
      switch (type) {
        case 'pg':
          return 'day';
        case 'mysql':
          return 'DAY';
        case 'sqlite':
          return 'days';
        case 'mssql':
          return 'day';
        default:
          return unit;
      }
    }
    case 'weeks':
    case 'w': {
      switch (type) {
        case 'pg':
          return 'week';
        case 'mysql':
          return 'WEEK';
        case 'sqlite':
          return 'weeks';
        case 'mssql':
          return 'week';
        default:
          return unit;
      }
    }
    case 'months':
    case 'M': {
      switch (type) {
        case 'pg':
          return 'month';
        case 'mysql':
          return 'MONTH';
        case 'sqlite':
          return 'months';
        case 'mssql':
          return 'month';
        default:
          return unit;
      }
    }
    case 'quarters':
    case 'Q': {
      switch (type) {
        case 'pg':
          return 'quarter';
        case 'mysql':
          return 'QUARTER';
        case 'sqlite':
          return 'quarters';
        case 'mssql':
          return 'quarter';
        default:
          return unit;
      }
    }
    case 'years':
    case 'y': {
      switch (type) {
        case 'pg':
          return 'year';
        case 'mysql':
          return 'YEAR';
        case 'sqlite':
          return 'years';
        case 'mssql':
          return 'year';
        default:
          return unit;
      }
    }
    default:
      // Reject unrecognized units — prevents raw SQL interpolation of unsanitized input
      return 'seconds';
  }
}
