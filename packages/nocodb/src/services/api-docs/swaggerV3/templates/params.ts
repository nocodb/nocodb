import { isLinksOrLTAR, isSelfLinkCol, UITypes } from 'nocodb-sdk';
import type { SwaggerColumn } from '../getSwaggerColumnMetasV3';
import type { SwaggerView } from '~/services/api-docs/shared/swaggerUtils';

export const recordIdParam = {
  schema: {
    type: 'string',
  },
  name: 'recordId',
  in: 'path',
  required: true,
  example: 1,
  description: 'Primary key of the record you want to read.',
};
export const fieldsParam = {
  schema: {
    type: 'array',
    items: {
      type: 'string',
    },
  },
  in: 'query',
  name: 'fields',
  description:
    'Specify fields to include in the API response. \n\nExample: fields=`field1` will include only field1 in the response.',
};
export const sortParam = {
  schema: {
    type: 'array',
    items: {
      type: 'string',
    },
  },
  in: 'query',
  name: 'sort',
  description:
    'Allows you to specify the fields by which you want to sort the records in your API response. Each sort object must have a \'field\' property specifying the field name and a \'direction\' property with value \'asc\' or \'desc\'. If **viewId** query parameter is also included, the sort included here will take precedence over any sorting configuration defined in the view. \n\nExample: sort=`{"direction":"asc", "field":"field1"}` will sort records in ascending order based on field1.',
};
export const whereParam = {
  schema: {
    type: 'string',
  },
  in: 'query',
  name: 'where',
  description:
    "Enables defining conditions to filter records in the API response. Multiple conditions can be combined using the logical operators 'and' or 'or'. Each condition consists of three components: a field name, a comparison operator, and a value.\n\nExample: where=`(field1,eq,value1)~and(field2,eq,value2)` will filter records where field1 equals value1 AND field2 equals value2.\n\nIf **viewId** parameter is also included, these filters are applied on top of the view’s predefined filter configuration. \n\n**NOTE**: Maintain the specified format; do not include spaces between components of a condition. For further information on this please see [the documentation](https://nocodb.com/docs/product-docs/developer-resources/rest-apis#v3-where-query-parameter)",
};
export const pageParam = {
  schema: {
    type: 'integer',
    minimum: 1,
  },
  in: 'query',
  name: 'page',
  description:
    'Controls pagination of the API response by specifying the page number to retrieve. By default, the first page is returned. Increment the page number to retrieve subsequent pages.\n\nExample: page=`2` will return the second page of data records in the dataset.',
};
export const pageSizeParam = {
  schema: {
    type: 'integer',
    minimum: 1,
  },
  in: 'query',
  name: 'pageSize',
  description:
    'Sets a limit on the number of records returned in the API response. By default, all available records are returned, but this parameter allows you to control the quantity.\n\nExample: pageSize=`100` will limit the response to 100 records per page.',
};
export const nestedPageParam = {
  schema: {
    type: 'integer',
    minimum: 1,
  },
  in: 'query',
  name: 'nestedPage',
  description:
    'Controls pagination of nested (linked) records in the API response by specifying the page number. By default, the first page is returned; increment the page number to retrieve subsequent pages.\n\nExample: nestedPage=`2` will return the second page of nested data records in the dataset.',
};

export const linkFieldNameParam = (columns: SwaggerColumn[]) => {
  const linkColumnIds = [];
  const description = [
    '**Links Field Identifier** corresponding to the relation field **Links** or **LinkToAnotherRecord** established between tables.\n\nLink Columns:',
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
    'Fetches records that are visible within a specific view. If the view has sorting enabled, the API returns records in the same order as displayed in the view. Specifying a **sort** query parameter overrides the view’s sorting configuration. Similarly, a **where** query parameter applies additional filtering on top of the view’s filters. By default, all fields—including those disabled in the view—are included in the response. Use the **fields** query parameter to include or exclude specific fields and customize the output.\n\n**Views:**',
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

export const attachmentFieldIdParam = (columns: SwaggerColumn[]) => {
  const attachmentColumnIds = [];
  const description = [
    '**Attachment Field Identifier** corresponding to the attachment field where you want to upload the file.\n\nAttachment Fields:',
  ];
  for (const { column } of columns) {
    // Only include attachment columns
    if (column.uidt !== UITypes.Attachment) continue;

    attachmentColumnIds.push(column.id);
    description.push(`* ${column.id} - ${column.title}`);
  }

  return {
    schema: {
      type: 'string',
      enum: attachmentColumnIds,
    },
    name: 'fieldId',
    in: 'path',
    required: true,
    description: description.join('\n'),
  };
};

export function hasAttachmentColumns(columns: SwaggerColumn[]): boolean {
  return columns.some(({ column }) => column.uidt === UITypes.Attachment);
}
