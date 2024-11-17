import { isLinksOrLTAR, RelationTypes, UITypes } from 'nocodb-sdk';
import type { LinkToAnotherRecordColumn } from '~/models';
import type { SwaggerColumn } from '../getSwaggerColumnMetas';
import type { SwaggerView } from '~/services/api-docs/swaggerV2/getSwaggerJSONV2';
import type { NcContext } from '~/interface/config';

export const recordIdParam = {
  schema: {
    type: 'string',
  },
  name: 'recordId',
  in: 'path',
  required: true,
  example: 1,
  description:
    'Primary key of the record you want to read. If the table have composite primary key then combine them by using `___` and pass it as primary key.',
};
export const fieldsParam = {
  schema: {
    type: 'string',
  },
  in: 'query',
  name: 'fields',
  description:
    'Array of field names or comma separated filed names to include in the response objects. In array syntax pass it like `fields[]=field1&fields[]=field2` or alternately `fields=field1,field2`.',
};
export const sortParam = {
  schema: {
    type: 'string',
  },
  in: 'query',
  name: 'sort',
  description:
    'Comma separated field names to sort rows, rows will sort in ascending order based on provided columns. To sort in descending order provide `-` prefix along with column name, like `-field`. Example : `sort=field1,-field2`',
};
export const whereParam = {
  schema: {
    type: 'string',
  },
  in: 'query',
  name: 'where',
  description:
    'This can be used for filtering rows, which accepts complicated where conditions. For more info visit [here](https://docs.nocodb.com/developer-resources/rest-apis#comparison-operators). Example : `where=(field1,eq,value)`',
};
export const limitParam = {
  schema: {
    type: 'number',
    minimum: 1,
  },
  in: 'query',
  name: 'limit',
  description:
    'The `limit` parameter used for pagination, the response collection size depends on limit value with default value `25` and maximum value `1000`, which can be overridden by environment variables `DB_QUERY_LIMIT_DEFAULT` and `DB_QUERY_LIMIT_MAX` respectively.',
  example: 25,
};
export const offsetParam = {
  schema: {
    type: 'number',
    minimum: 0,
  },
  in: 'query',
  name: 'offset',
  description:
    'The `offset` parameter used for pagination, the value helps to select collection from a certain index.',
  example: 0,
};

export const shuffleParam = {
  schema: {
    type: 'number',
    minimum: 0,
    maximum: 1,
  },
  in: 'query',
  name: 'shuffle',
  description:
    'The `shuffle` parameter used for pagination, the response will be shuffled if it is set to 1.',
  example: 0,
};

export const columnNameQueryParam = {
  schema: {
    type: 'string',
  },
  in: 'query',
  name: 'column_name',
  description:
    'Column name of the column you want to group by, eg. `column_name=column1`',
};

export const linkFieldNameParam = (columns: SwaggerColumn[]) => {
  const linkColumnIds = [];
  const description = [
    '**Links Field Identifier** corresponding to the relation field `Links` established between tables.\n\nLink Columns:',
  ];
  for (const { column } of columns) {
    if (!isLinksOrLTAR(column) || column.system) continue;
    linkColumnIds.push(column.id);

    description.push(`* ${column.id} - ${column.title}`);
  }

  return {
    schema: {
      type: 'string',
      enum: linkColumnIds,
    },
    name: 'linkFieldId',
    in: 'path',
    required: true,
    description: description.join('\n'),
  };
};
export const viewIdParams = (views: SwaggerView[]) => {
  const viewIds = [];
  const description = [
    'Allows you to fetch records that are currently visible within a specific view.\n\nViews:',
  ];

  for (const { view } of views) {
    viewIds.push(view.id);
    description.push(
      `* ${view.id} - ${view.is_default ? 'Default view' : view.title}`,
    );
  }

  return {
    schema: {
      type: 'string',
      enum: viewIds,
    },
    description: description.join('\n'),
    name: 'viewId',
    in: 'query',
    required: false,
  };
};

export const referencedRowIdParam = {
  schema: {
    type: 'string',
  },
  name: 'refRowId',
  in: 'path',
  required: true,
};

export const exportTypeParam = {
  schema: {
    type: 'string',
    enum: ['csv', 'excel'],
  },
  name: 'type',
  in: 'path',
  required: true,
};

export const csvExportOffsetParam = {
  schema: {
    type: 'number',
    minimum: 0,
  },
  in: 'query',
  name: 'offset',
  description:
    'Helps to start export from a certain index. You can get the next set of data offset from previous response header named `nc-export-offset`.',
  example: 0,
};

export const nestedWhereParam = (colName) => ({
  schema: {
    type: 'string',
  },
  in: 'query',
  name: `nested[${colName}][where]`,
  description: `This can be used for filtering rows in nested column \`${colName}\`, which accepts complicated where conditions. For more info visit [here](https://docs.nocodb.com/developer-resources/rest-apis#comparison-operators). Example : \`nested[${colName}][where]=(field1,eq,value)\``,
});

export const nestedFieldParam = (colName) => ({
  schema: {
    type: 'string',
  },
  in: 'query',
  name: `nested[${colName}][fields]`,
  description: `Array of field names or comma separated filed names to include in the in nested column \`${colName}\` result. In array syntax pass it like \`fields[]=field1&fields[]=field2.\`. Example : \`nested[${colName}][fields]=field1,field2\``,
});
export const nestedSortParam = (colName) => ({
  schema: {
    type: 'string',
  },
  in: 'query',
  name: `nested[${colName}][sort]`,
  description: `Comma separated field names to sort rows in nested column \`${colName}\` rows, it will sort in ascending order based on provided columns. To sort in descending order provide \`-\` prefix along with column name, like \`-field\`. Example : \`nested[${colName}][sort]=field1,-field2\``,
});
export const nestedLimitParam = (colName) => ({
  schema: {
    type: 'number',
    minimum: 1,
  },
  in: 'query',
  name: `nested[${colName}][limit]`,
  description: `The \`limit\` parameter used for pagination of nested \`${colName}\` rows, the response collection size depends on limit value and default value is \`25\`.`,
  example: '25',
});
export const nestedOffsetParam = (colName) => ({
  schema: {
    type: 'number',
    minimum: 0,
  },
  in: 'query',
  name: `nested[${colName}][offset]`,
  description: `The \`offset\` parameter used for pagination  of nested \`${colName}\` rows, the value helps to select collection from a certain index.`,
  example: 0,
});

export const getNestedParams = async (
  context: NcContext,
  columns: SwaggerColumn[],
): Promise<any[]> => {
  return await columns.reduce(async (paramsArr, { column }) => {
    if (column.uidt === UITypes.LinkToAnotherRecord && !column.system) {
      const colOpt = await column.getColOptions<LinkToAnotherRecordColumn>(
        context,
      );
      if (colOpt.type !== RelationTypes.BELONGS_TO) {
        return [
          ...(await paramsArr),
          nestedWhereParam(column.title),
          nestedOffsetParam(column.title),
          nestedLimitParam(column.title),
          nestedFieldParam(column.title),
          nestedSortParam(column.title),
        ];
      } else {
        return [...(await paramsArr), nestedFieldParam(column.title)];
      }
    }

    return paramsArr;
  }, Promise.resolve([]));
};
