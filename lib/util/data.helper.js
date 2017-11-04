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


exports.round = function(number, precision) {
  var factor = Math.pow(10, precision);
  var tempNumber = number * factor;
  var roundedTempNumber = Math.round(tempNumber);
  return roundedTempNumber / factor;
};

exports.getSchemaQuery = function () {
  return 'select c.table_name, c.column_name, c.ordinal_position,c.column_key,c.is_nullable, c.data_type, c.column_type,c.extra,c.privileges, ' +
    'c.column_comment,c.column_default,c.data_type,c.character_maximum_length, ' +
    'k.constraint_name, k.referenced_table_name, k.referenced_column_name, ' +
    's.index_name,s.seq_in_index ' +
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
    'where ' +
    'c.table_schema=? ' +
    'order by ' +
    'c.table_name, c.ordinal_position';
};
