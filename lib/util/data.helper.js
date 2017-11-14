'use strict';


exports.findOrInsertObjectArrayByKey = (obj, key, array) => {

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
    array.push(obj)
  }

  return array[i];
};


exports.findObjectInArrayByKey = (key, value, objArray) => {

  for (let i = 0; i < objArray.length; ++i) {
    if (objArray[i][key] === value) {
      return objArray[i];
    }
  }

  return null;
};


exports.round = function (number, precision) {
  var factor = Math.pow(10, precision);
  var tempNumber = number * factor;
  var roundedTempNumber = Math.round(tempNumber);
  return roundedTempNumber / factor;
};


exports.numberRound = (number, precision) => {
  var factor = Math.pow(10, precision);
  var tempNumber = number * factor;
  var roundedTempNumber = Math.round(tempNumber);
  return roundedTempNumber / factor;
}

exports.numberGetLength = (number) => {

  var n = number;

  if (number < 0) {
    n = n * -1;
  }

  return n.toString().length;
}

exports.numberGetFixed = (number) => {
  //console.log(number, typeof number);
  return parseInt(number.toFixed())
}

exports.getRangeSimple = function (min, max, step) {

  var arr = []
  for (var i = min; i <= max; i = i + step) {
    arr.push(i)
  }

  return arr;

};

exports.getRange = (min, max, stddev) => {

  // console.log(' = = = = = = = ');
  //console.log('original numbers', min, max, stddev);

  min = this.numberGetFixed(min)
  max = this.numberGetFixed(max)
  stddev = this.numberGetFixed(stddev)

  // console.log('fixed numbers', min, max, stddev);

  let minMinusHalf = min - stddev / 2
  let maxMinusHalf = max + stddev / 2

  minMinusHalf = this.numberGetFixed(minMinusHalf)
  maxMinusHalf = this.numberGetFixed(maxMinusHalf)

  // console.log('fixed numbers + (min,max)', min, max, stddev, '(', minMinusHalf, ',', maxMinusHalf, ')');
  // console.log('numbers length', 'min', numberGetLength(min), 'max', numberGetLength(max), 'stddev', numberGetLength(stddev));

  let minLen = this.numberGetLength(minMinusHalf)
  let maxLen = this.numberGetLength(maxMinusHalf)
  let stddevLen = this.numberGetLength(stddev)
  //
  // console.log('- - - -');
  // console.log('Range', 'min', numberRound(minMinusHalf, -1));
  // console.log('Range', 'max', numberRound(maxMinusHalf, -1));
  // console.log('Range', 'stddev', numberRound(stddev, -1));

  if (minLen > 1)
    minMinusHalf = this.numberRound(minMinusHalf, -1)

  if (maxLen > 2)
    maxMinusHalf = this.numberRound(maxMinusHalf, -1)

  if (stddevLen !== 1)
    stddev = this.numberRound(stddev, -1)


  var arr = []
  for (var step = minMinusHalf; step < maxMinusHalf; step = step + stddev) {
    arr.push(step)
  }
  arr.push(maxMinusHalf)

  // console.log(arr);

  return arr;
}


exports.getSchemaQuery = function () {
  return 'select c.table_name, c.column_name, c.ordinal_position,c.column_key,c.is_nullable, c.data_type, c.column_type,c.extra,c.privileges, ' +
    'c.column_comment,c.column_default,c.data_type,c.character_maximum_length, ' +
    'k.constraint_name, k.referenced_table_name, k.referenced_column_name, ' +
    's.index_name,s.seq_in_index, ' +
    'v.table_name as isView ' +
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
    'c.table_name, c.ordinal_position';
};

exports.getChartQuery = function () {
  return 'select ? as ??, count(*) as _count from ?? where ?? between ? and ? '
}

