export const mapDataType = function (type) {
  switch (type) {
    case 'int':
    case 'tinyint':
    case 'smallint':
    case 'mediumint':
    case 'bigint':
    case 'bit':
    case 'boolean':
    case 'float':
    case 'decimal':
    case 'double':
    case 'serial':
      return 'number';
    case 'date':
    case 'datetime':
    case 'timestamp':
    case 'time':
    case 'year':
      return 'date';
    case 'char':
    case 'varchar':
    case 'nchar':
    case 'text':
    case 'tinytext':
    case 'mediumtext':
    case 'longtext':
      return 'string';
    case 'binary':
      break;
    case 'varbinary':
      break;
    case 'blob':
      break;
    case 'tinyblob':
      break;
    case 'mediumblob':
      break;
    case 'longblob':
      break;
    case 'enum':
    case 'set':
      return 'string';
      break;
    case 'geometry':
      break;
    case 'point':
      break;
    case 'linestring':
      break;
    case 'polygon':
      break;
    case 'multipoint':
      break;
    case 'multilinestring':
      break;
    case 'multipolygon':
      break;
    case 'json':
      return 'string';
      break;
  }

  return 'string';
};
