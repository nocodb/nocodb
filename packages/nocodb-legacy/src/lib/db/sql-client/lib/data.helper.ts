export const findOrInsertObjectArrayByKey = (obj, key, array) => {
  let found = 0;
  let i = 0;

  for (i = 0; i < array.length; ++i) {
    if (key in array[i]) {
      if (obj[key] === array[i][key]) {
        found = 1;
        break;
      }
    }
  }

  if (!found) {
    array.push(obj);
  }

  return array[i];
};

export const findObjectInArrayByKey = (key, value, objArray) => {
  for (let i = 0; i < objArray.length; ++i) {
    if (objArray[i][key] === value) {
      return objArray[i];
    }
  }

  return null;
};

export const round = function (number, precision) {
  const factor = Math.pow(10, precision);
  const tempNumber = number * factor;
  const roundedTempNumber = Math.round(tempNumber);
  return roundedTempNumber / factor;
};

export const numberRound = (number, precision) => {
  const factor = Math.pow(10, precision);
  const tempNumber = number * factor;
  const roundedTempNumber = Math.round(tempNumber);
  return roundedTempNumber / factor;
};

export const numberGetLength = (number) => {
  let n = number;

  if (number < 0) {
    n = n * -1;
  }

  return n.toString().length;
};

export const numberGetFixed = (number) => {
  //console.log(number, typeof number);
  return parseInt(number.toFixed());
};

export const getStepArraySimple = function (min, max, step) {
  const arr = [];
  for (let i = min; i <= max; i = i + step) {
    arr.push(i);
  }

  return arr;
};

export const getStepArray = (min, max, stddev) => {
  // console.log(' = = = = = = = ');
  //console.log('original numbers', min, max, stddev);

  min = numberGetFixed(min);
  max = numberGetFixed(max);
  stddev = numberGetFixed(stddev);

  // console.log('fixed numbers', min, max, stddev);

  let minMinusHalf = min - stddev / 2;
  let maxMinusHalf = max + stddev / 2;

  minMinusHalf = numberGetFixed(minMinusHalf);
  maxMinusHalf = numberGetFixed(maxMinusHalf);

  // console.log('fixed numbers + (min,max)', min, max, stddev, '(', minMinusHalf, ',', maxMinusHalf, ')');
  // console.log('numbers length', 'min', numberGetLength(min), 'max', numberGetLength(max), 'stddev', numberGetLength(stddev));

  const minLen = numberGetLength(minMinusHalf);
  const maxLen = numberGetLength(maxMinusHalf);
  const stddevLen = numberGetLength(stddev);
  //
  // console.log('- - - -');
  // console.log('Range', 'min', numberRound(minMinusHalf, -1));
  // console.log('Range', 'max', numberRound(maxMinusHalf, -1));
  // console.log('Range', 'stddev', numberRound(stddev, -1));

  if (minLen > 1) minMinusHalf = numberRound(minMinusHalf, -1);

  if (maxLen > 2) maxMinusHalf = numberRound(maxMinusHalf, -1);

  if (stddevLen !== 1) stddev = numberRound(stddev, -1);

  const arr = [];
  for (let step = minMinusHalf; step < maxMinusHalf; step = step + stddev) {
    arr.push(step);
  }
  arr.push(maxMinusHalf);

  // console.log(arr);

  return arr;
};

export const getMysqlSchemaQuery = function () {
  return (
    'select ' +
    'c.table_name as tn, c.column_name as cn, c.ordinal_position as cop,' +
    'c.column_key as ck,c.is_nullable as nrqd, c.data_type, c.column_type as ct,c.extra as ext,c.privileges as priv, ' +
    'c.cc,c.cdf as cdf,c.data_type,' +
    'c.character_maximum_length as clen,c.numeric_precision as np,c.numeric_scale as ns,c.datetime_precision as dp, ' +
    'k.constraint_name as cstn, k.referenced_table_name as rtn, k.referenced_column_name as rcn, ' +
    's.index_name,s.seq_in_index, ' +
    'v.table_name as is_view ' +
    'from ' +
    'information_schema.columns as c ' +
    'left join ' +
    'information_schema.key_column_usage as k ' +
    'on ' +
    'c.column_name=k.column_name and ' +
    'c.table_schema = k.referenced_table_schema and ' +
    'c.table_name = k.table_name ' +
    'left join ' +
    'information_schema.statistics as s ' +
    'on ' +
    'c.column_name = s.column_name and ' +
    'c.table_schema = s.index_schema and ' +
    'c.table_name = s.table_name ' +
    'LEFT JOIN ' +
    'information_schema.VIEWS as v ' +
    'ON ' +
    'c.table_schema = v.table_schema and ' +
    'c.table_name = v.table_name ' +
    'where ' +
    'c.table_schema=? ' +
    'order by ' +
    'c.table_name, c.ordinal_position'
  );
};

export const getChartQuery = function () {
  return 'select ? as ??, count(*) as _count from ?? where ?? between ? and ? ';
};

export const getDataType = function (colType, typesArr) {
  // console.log(colType,typesArr);
  for (let i = 0; i < typesArr.length; ++i) {
    if (colType.indexOf(typesArr[i]) !== -1) {
      return 1;
    }
  }
  return 0;
};

export const getColumnType = function (column) {
  const strTypes = [
    'varchar',
    'text',
    'char',
    'tinytext',
    'mediumtext',
    'longtext',
    'ntext',
    'image',
    'blob',
    'mediumblob',
    'longblob',
    'binary',
    'varbinary',
    'character',
    'character varying',
    'nchar',
    'nvarchar',
    'clob',
    'nvarchar2',
    'varchar2',
    'raw',
    'long raw',
    'bfile',
    'nclob',
  ];
  const intTypes = [
    'bit',
    'integer',
    'int',
    'smallint',
    'mediumint',
    'bigint',
    'tinyint',
    'int2',
    'int4',
    'int8',
    'long',
    'serial',
    'bigserial',
    'smallserial',
    'bool',
    'boolean',
    'number',
  ];
  const floatTypes = [
    'float',
    'double',
    'decimal',
    'numeric',
    'real',
    'double precision',
    'real',
    'money',
    'smallmoney',
    'dec',
  ];
  const dateTypes = [
    'date',
    'datetime',
    'timestamp',
    'time',
    'year',
    'timestamp without time zone',
    'timestamp with time zone',
    'time without time zone',
    'time with time zone',
    'datetime2',
    'smalldatetime',
    'datetimeoffset',
    'interval year',
    'interval day',
  ];

  // const rowIds = ['rowId', 'urowid'];

  //console.log(column);
  if (getDataType(column['data_type'], strTypes)) {
    return 'string';
  } else if (getDataType(column['data_type'], intTypes)) {
    return 'int';
  } else if (getDataType(column['data_type'], floatTypes)) {
    return 'float';
  } else if (getDataType(column['data_type'], dateTypes)) {
    return 'date';
  } else {
    return 'string';
  }
};

export const getType = function (colType, typesArr) {
  // for (let i = 0; i < typesArr.length; ++i) {
  //   // if (typesArr[i].indexOf(colType) !== -1) {
  //   //   return 1;
  //   // }
  //
  //   if (colType.indexOf(typesArr[i]) !== -1) {
  //     return 1;
  //   }
  // }
  return typesArr.includes(colType);
  //return 0;
};
