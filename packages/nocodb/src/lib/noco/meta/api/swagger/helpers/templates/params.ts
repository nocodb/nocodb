export const rowIdParam = {
  schema: {
    type: 'string'
  },
  name: 'rowId',
  in: 'path',
  required: true,
  example: ['1'],
  description:
    'Primary key of the record you want to read. If the table have composite primary key then combine them by using `___` and pass it as primary key.'
};

export const relationTypeParam = {
  schema: {
    type: 'string',
    enum: ['mm', 'hm']
  },
  name: 'relationType',
  in: 'path',
  required: true
};

export const fieldsParam = {
  schema: {
    type: 'array'
  },
  in: 'query',
  name: 'fields',
  description:
    'Array of field names or comma separated filed names to include in the response objects. In array syntax pass it like `fields[]=field1&fields[]=field2`.',
  example: 'field1,field2'
};
export const sortParam = {
  schema: {
    type: 'array'
  },
  in: 'query',
  name: 'sort',
  description:
    'Comma separated field names to sort rows, rows will sort in ascending order based on provided columns. To sort in descending order provide `-` prefix along with column name, like `-field`',
  example: 'field1,-field2'
};
export const whereParam = {
  schema: {
    type: 'string'
  },
  in: 'query',
  name: 'where',
  description:
    'This can be used for filtering rows, which accepts complicated where conditions. For more info visit [here](https://docs.nocodb.com/developer-resources/rest-apis#comparison-operators)',
  example: '(field1,eq,value)'
};
export const limitParam = {
  schema: {
    type: 'number',
    minimum: 1
  },
  in: 'query',
  name: 'limit',
  description:
    'The `limit` parameter used for pagination, the response collection size depends on limit value and default value is `25`.',
  example: '25'
};
export const offsetParam = {
  schema: {
    type: 'number',
    minimum: 0
  },
  in: 'query',
  name: 'offset',
  description:
    'The `offset` parameter used for pagination, the value helps to select collection from a certain index.',
  example: '25'
};

export const columnNameParam = {
  schema: {
    type: 'string'
  },
  name: 'columnName',
  in: 'path',
  required: true
};

export const referencedRowIdParam = {
  schema: {
    type: 'string'
  },
  name: 'refRowId',
  in: 'path',
  required: true
};

export const exportTypeParam = {
  schema: {
    type: 'string',
    enum: ['csv', 'excel']
  },
  name: 'type',
  in: 'path',
  required: true
};

export const csvExportOffsetParam = {
  schema: {
    type: 'number',
    minimum: 0
  },
  in: 'query',
  name: 'offset',
  description:
    'Helps to start export from a certain index. You can get the next set of data offset from previous response header named `nc-export-offset`.',
  example: '25'
};
