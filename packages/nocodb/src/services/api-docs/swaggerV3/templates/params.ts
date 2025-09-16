import { isLinksOrLTAR, isSelfLinkCol } from 'nocodb-sdk';
import type { SwaggerColumn } from '../getSwaggerColumnMetasV3';
import type { SwaggerView } from '~/services/api-docs/swaggerV3/getSwaggerJSONV3';

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
    oneOf: [
      {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      {
        type: 'string',
      },
    ],
  },
  in: 'query',
  name: 'fields',
  description:
    'Allows you to specify the fields that you wish to include from the linked records in your API response. By default, only Primary Key and associated display value field is included.\n\nExample: `fields=["field1","field2"]` or `fields=field1,field2` will include only \'field1\' and \'field2\' in the API response.',
};
export const sortParam = {
  schema: {
    oneOf: [
      {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            direction: {
              type: 'string',
              enum: ['asc', 'desc'],
            },
            field: {
              type: 'string',
            },
          },
          required: ['field', 'direction'],
        },
      },
      {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            enum: ['asc', 'desc'],
          },
          field: {
            type: 'string',
          },
        },
        required: ['field', 'direction'],
      },
    ],
  },
  in: 'query',
  name: 'sort',
  description:
    'Allows you to specify the fields by which you want to sort the records in your API response. Accepts either an array of sort objects or a single sort object.\n\nEach sort object must have a \'field\' property specifying the field name and a \'direction\' property with value \'asc\' or \'desc\'.\n\nExample: `sort=[{"direction":"asc","field":"field_name"},{"direction":"desc","field":"another_field"}]` or `sort={"direction":"asc","field":"field_name"}`\n\nIf `viewId` query parameter is also included, the sort included here will take precedence over any sorting configuration defined in the view.',
};
export const whereParam = {
  schema: {
    type: 'string',
  },
  in: 'query',
  name: 'where',
  description:
    "Enables you to define specific conditions for filtering records in your API response. Multiple conditions can be combined using logical operators such as 'and' and 'or'. Each condition consists of three parts: a field name, a comparison operator, and a value.\n\nExample: `where=(field1,eq,value1)~and(field2,eq,value2)` will filter records where 'field1' is equal to 'value1' AND 'field2' is equal to 'value2'. \n\nYou can also use other comparison operators like 'neq' (not equal), 'gt' (greater than), 'lt' (less than), and more, to create complex filtering rules.\n\nIf `viewId` query parameter is also included, then the filters included here will be applied over the filtering configuration defined in the view. \n\nPlease remember to maintain the specified format, and do not include spaces between the different condition components",
};
export const pageParam = {
  schema: {
    type: 'integer',
    minimum: 1,
  },
  in: 'query',
  name: 'page',
  description:
    'Enables you to control the pagination of your API response by specifying the page number you want to retrieve. By default, the first page is returned. If you want to retrieve the next page, you can increment the page number by one.\n\nExample: `page=2` will return the second page of records in the dataset.',
};
export const pageSizeParam = {
  schema: {
    type: 'integer',
    minimum: 1,
  },
  in: 'query',
  name: 'pageSize',
  description:
    'Enables you to set a limit on the number of records you want to retrieve in your API response. By default, your response includes all the available records, but by using this parameter, you can control the quantity you receive.\n\nExample: `pageSize=100` will constrain your response to the first 100 records in the dataset.',
};
export const nestedPageParam = {
  schema: {
    type: 'integer',
    minimum: 1,
  },
  in: 'query',
  name: 'nestedPage',
  description:
    'Enables you to control the pagination of your nested data (linked records) in API response by specifying the page number you want to retrieve. By default, the first page is returned. If you want to retrieve the next page, you can increment the page number by one.\n\nExample: `page=2` will return the second page of nested data records in the dataset.',
};

export const linkFieldNameParam = (columns: SwaggerColumn[]) => {
  const linkColumnIds = [];
  const description = [
    '**Links Field Identifier** corresponding to the relation field `Links` established between tables.\n\nLink Columns:',
  ];
  for (const { column } of columns) {
    // Skip non-link columns and non-self-link system columns
    if (!isLinksOrLTAR(column) || (column.system && !isSelfLinkCol(column)))
      continue;

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
export const viewIdParam = (views: SwaggerView[]) => {
  const viewIds = [];
  const description = [
    '***View Identifier***. Allows you to fetch records that are currently visible within a specific view. API retrieves records in the order they are displayed if the SORT option is enabled within that view.\n\nAdditionally, if you specify a `sort` query parameter, it will take precedence over any sorting configuration defined in the view. If you specify a `where` query parameter, it will be applied over the filtering configuration defined in the view. \n\nBy default, all fields, including those that are disabled within the view, are included in the response. To explicitly specify which fields to include or exclude, you can use the `fields` query parameter to customize the output according to your requirements.\n\nViews:',
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
