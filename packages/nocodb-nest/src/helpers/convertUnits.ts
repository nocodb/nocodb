export function convertUnits(
  unit: string,
  type: 'mysql' | 'mssql' | 'pg' | 'sqlite',
) {
  switch (unit) {
    case 'milliseconds':
    case 'ms': {
      switch (type) {
        case 'mssql':
          return 'millisecond';
        case 'mysql':
          // MySQL doesn't support millisecond
          // hence change from MICROSECOND to millisecond manually
          return 'MICROSECOND';
        case 'pg':
        case 'sqlite':
          return 'milliseconds';
        default:
          return unit;
      }
    }
    case 'seconds':
    case 's': {
      switch (type) {
        case 'mssql':
        case 'pg':
          return 'second';
        case 'mysql':
          return 'SECOND';
        case 'sqlite':
          return 'seconds';
        default:
          return unit;
      }
    }
    case 'minutes':
    case 'm': {
      switch (type) {
        case 'mssql':
        case 'pg':
          return 'minute';
        case 'mysql':
          return 'MINUTE';
        case 'sqlite':
          return 'minutes';
        default:
          return unit;
      }
    }
    case 'hours':
    case 'h': {
      switch (type) {
        case 'mssql':
        case 'pg':
          return 'hour';
        case 'mysql':
          return 'HOUR';
        case 'sqlite':
          return 'hours';
        default:
          return unit;
      }
    }
    case 'days':
    case 'd': {
      switch (type) {
        case 'mssql':
        case 'pg':
          return 'day';
        case 'mysql':
          return 'DAY';
        case 'sqlite':
          return 'days';
        default:
          return unit;
      }
    }
    case 'weeks':
    case 'w': {
      switch (type) {
        case 'mssql':
        case 'pg':
          return 'week';
        case 'mysql':
          return 'WEEK';
        case 'sqlite':
          return 'weeks';
        default:
          return unit;
      }
    }
    case 'months':
    case 'M': {
      switch (type) {
        case 'mssql':
        case 'pg':
          return 'month';
        case 'mysql':
          return 'MONTH';
        case 'sqlite':
          return 'months';
        default:
          return unit;
      }
    }
    case 'quarters':
    case 'Q': {
      switch (type) {
        case 'mssql':
        case 'pg':
          return 'quarter';
        case 'mysql':
          return 'QUARTER';
        case 'sqlite':
          return 'quarters';
        default:
          return unit;
      }
    }
    case 'years':
    case 'y': {
      switch (type) {
        case 'mssql':
        case 'pg':
          return 'year';
        case 'mysql':
          return 'YEAR';
        case 'sqlite':
          return 'years';
        default:
          return unit;
      }
    }
    default:
      return unit;
  }
}
