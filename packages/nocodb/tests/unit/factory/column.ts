import { UITypes } from 'nocodb-sdk';
import request from 'supertest';

import {
  Base,
  FormViewColumn,
  GridViewColumn,
  GalleryViewColumn,
  Column,
  View,
  Model,
} from '../../../src/models';
import init from '../init';

type Context = Awaited<ReturnType<typeof init>>;

const defaultColumns = function (
  context: Context,
  isV3: boolean = false,
  optionsOverride: Record<string, any> = {},
) {
  return [
    isV3
      ? {
          title: 'Id',
          type: UITypes.ID,
          description: `Test ${UITypes.ID}`,
          options: {
            ...optionsOverride['Id'],
          },
        }
      : {
          column_name: 'id',
          title: 'Id',
          uidt: UITypes.ID,
          description: `Test ${UITypes.ID}`,
          ...optionsOverride['Id'],
        },
    isV3
      ? {
          title: 'Title',
          type: UITypes.SingleLineText,
          description: `Title ${UITypes.SingleLineText}`,
          options: {
            ...optionsOverride['Title'],
          },
        }
      : {
          column_name: 'title',
          title: 'Title',
          uidt: UITypes.SingleLineText,
          description: `Title ${UITypes.SingleLineText}`,
          ...optionsOverride['Title'],
        },
    // isV3
    //   ? {
    //       title: 'CreatedAt',
    //       type: UITypes.CreatedTime,
    //       description: `CreatedAt ${UITypes.CreatedTime}`,
    //       options: {
    //         ...optionsOverride['CreatedAt'],
    //       },
    //     }
    //   : {
    //       column_name: 'created_at',
    //       title: 'CreatedAt',
    //       uidt: UITypes.CreatedTime,
    //       description: `CreatedAt ${UITypes.CreatedTime}`,
    //       ...optionsOverride['CreatedAt'],
    //     },
    // isV3
    //   ? {
    //       title: 'UpdatedAt',
    //       type: UITypes.LastModifiedTime,
    //       description: `UpdatedAt ${UITypes.LastModifiedTime}`,
    //       options: {
    //         ...optionsOverride['UpdateAt'],
    //       },
    //     }
    //   : {
    //       column_name: 'updated_at',
    //       title: 'UpdatedAt',
    //       uidt: UITypes.LastModifiedTime,
    //       description: `UpdatedAt ${UITypes.LastModifiedTime}`,
    //       ...optionsOverride['UpdateAt'],
    //     },
    // isV3
    //   ? {
    //       title: 'CreatedBy',
    //       type: UITypes.CreatedBy,
    //       description: `CreatedBy ${UITypes.CreatedBy}`,
    //       options: {
    //         ...optionsOverride['CreatedBy'],
    //       },
    //     }
    //   : {
    //       column_name: 'created_by',
    //       title: 'CreatedBy',
    //       uidt: UITypes.CreatedBy,
    //       description: `CreatedBy ${UITypes.CreatedBy}`,
    //       ...optionsOverride['CreatedBy'],
    //     },
    // isV3
    //   ? {
    //       title: 'UpdatedBy',
    //       type: UITypes.LastModifiedBy,
    //       description: `UpdatedBy ${UITypes.LastModifiedBy}`,
    //       options: {
    //         ...optionsOverride['UpdatedBy'],
    //       },
    //     }
    //   : {
    //       column_name: 'updated_by',
    //       title: 'UpdatedBy',
    //       uidt: UITypes.LastModifiedBy,
    //       description: `UpdatedBy ${UITypes.LastModifiedBy}`,
    //       ...optionsOverride['UpdatedBy'],
    //     },
  ];
};

const customColumns = function (
  type: string,
  options: any = {},
  optionsOverride: any = {},
  isV3: boolean = false,
) {
  switch (type) {
    case 'textBased':
      return [
        isV3
          ? {
              title: 'id',
              type: UITypes.ID,
              description: `id ${UITypes.ID}`,
              options: {
                ...options['id'],
              },
            }
          : {
              column_name: 'id',
              title: 'Id',
              uidt: UITypes.ID,
              description: `id ${UITypes.ID}`,
              ...options['id'],
            },
        isV3
          ? {
              title: 'SingleLineText',
              type: UITypes.SingleLineText,
              description: `SingleLineText ${UITypes.SingleLineText}`,
              options: {
                ...optionsOverride['SingleLineText'],
              },
            }
          : {
              column_name: 'SingleLineText',
              title: 'SingleLineText',
              uidt: UITypes.SingleLineText,
              description: `SingleLineText ${UITypes.SingleLineText}`,
            },
        isV3
          ? {
              title: 'MultiLineText',
              type: UITypes.LongText,
              description: `MultiLineText ${UITypes.LongText}`,
              options: {
                rich_text: true,
                generate_text_using_ai: true,
                ...optionsOverride['MultiLineText'],
              },
            }
          : {
              column_name: 'MultiLineText',
              title: 'MultiLineText',
              uidt: UITypes.LongText,
              description: `MultiLineText ${UITypes.LongText}`,
              meta: {
                richText: true,
                ...optionsOverride['MultiLineText'],
              },
            },
        isV3
          ? {
              title: 'Email',
              type: UITypes.Email,
              description: `Email ${UITypes.Email}`,
              options: {
                validation: true,
                ...optionsOverride['Email'],
              },
            }
          : {
              column_name: 'Email',
              title: 'Email',
              uidt: UITypes.Email,
              meta: {
                validation: true,
                ...optionsOverride['Email'],
              },
            },
        isV3
          ? {
              title: 'Phone',
              type: UITypes.PhoneNumber,
              description: `Phone ${UITypes.PhoneNumber}`,
              options: {
                validation: true,
                ...optionsOverride['Phone'],
              },
            }
          : {
              column_name: 'Phone',
              title: 'Phone',
              uidt: UITypes.PhoneNumber,
              meta: {
                validation: true,
                ...optionsOverride['Phone'],
              },
            },
        isV3
          ? {
              title: 'Url',
              type: UITypes.URL,
              description: `Url ${UITypes.URL}`,
              options: {
                validation: true,
                ...optionsOverride['Url'],
              },
            }
          : {
              column_name: 'Url',
              title: 'Url',
              uidt: UITypes.URL,
              meta: {
                validation: true,
                ...optionsOverride['Url'],
              },
            },
      ];
    case 'numberBased':
      return [
        isV3
          ? {
              title: 'id',
              type: UITypes.ID,
              description: `id ${UITypes.ID}`,
              options: {
                ...optionsOverride['id'],
              },
            }
          : {
              column_name: 'id',
              title: 'Id',
              uidt: UITypes.ID,
              meta: {
                ...optionsOverride['id'],
              },
            },
        isV3
          ? {
              title: 'Number',
              type: UITypes.Number,
              description: `Number ${UITypes.Number}`,
              options: {
                precision: 4,
                allow_negative: false,
                ...optionsOverride['Number'],
              },
            }
          : {
              column_name: 'Number',
              title: 'Number',
              uidt: UITypes.Number,
              meta: {
                ...optionsOverride['Number'],
              },
            },
        isV3
          ? {
              title: 'Decimal',
              type: UITypes.Decimal,
              description: `Decimal ${UITypes.Decimal}`,
              options: {
                precision: 4,
                allow_negative: false,
                ...optionsOverride['Decimal'],
              },
            }
          : {
              column_name: 'Decimal',
              title: 'Decimal',
              uidt: UITypes.Decimal,
              meta: {
                ...optionsOverride['Decimal'],
              },
            },
        isV3
          ? {
              title: 'Currency',
              type: UITypes.Currency,
              description: `Currency ${UITypes.Currency}`,
              options: {
                locale: 'en-USD',
                code: 'USD',
                ...optionsOverride['Currency'],
              },
            }
          : {
              column_name: 'Currency',
              title: 'Currency',
              uidt: UITypes.Currency,
              meta: {
                currency_locale: 'en-USD',
                currency_code: 'USD',
                ...optionsOverride['Currency'],
              },
            },
        isV3
          ? {
              title: 'Percent',
              type: UITypes.Percent,
              description: `Percent ${UITypes.Percent}`,
              options: {
                precision: 4,
                show_as_progress: true,
                ...optionsOverride['Percent'],
              },
            }
          : {
              column_name: 'Percent',
              title: 'Percent',
              uidt: UITypes.Percent,
              meta: {
                is_progress: true,
                ...optionsOverride['Percent'],
              },
            },
        isV3
          ? {
              title: 'Duration',
              type: UITypes.Duration,
              description: `Duration ${UITypes.Duration}`,
              options: {
                format: 'h:mm',
                ...optionsOverride['Duration'],
              },
            }
          : {
              column_name: 'Duration',
              title: 'Duration',
              uidt: UITypes.Duration,
              meta: {
                duration: 0,
                ...optionsOverride['Duration'],
              },
            },
        isV3
          ? {
              title: 'Rating',
              type: UITypes.Rating,
              description: `Rating ${UITypes.Rating}`,
              options: {
                icon: 'Check',
                max_value: 5,
                color: '#232323',
                ...optionsOverride['Rating'],
              },
            }
          : {
              column_name: 'Rating',
              title: 'Rating',
              uidt: UITypes.Rating,
              meta: {
                iconIdx: 'Check',
                max: 5,
                color: '#232323',
                ...optionsOverride['Rating'],
              },
            },
      ];
    case 'dateBased':
      return [
        isV3
          ? {
              title: 'id',
              type: UITypes.ID,
              description: `id ${UITypes.ID}`,
              options: {
                ...optionsOverride['id'],
              },
            }
          : {
              column_name: 'id',
              title: 'Id',
              uidt: UITypes.ID,
            },
        isV3
          ? {
              title: 'Date',
              type: UITypes.Date,
              description: `Date ${UITypes.Date}`,
              options: {
                date_format: 'YYYY/MM/DD',
                time_format: undefined,
                '12hr_format': undefined,
                ...optionsOverride['Date'],
              },
            }
          : {
              column_name: 'Date',
              title: 'Date',
              uidt: UITypes.Date,
              meta: {
                date_format: 'YYYY/MM/DD',
                ...optionsOverride['Date'],
              },
            },
        isV3
          ? {
              title: 'DateTime',
              type: UITypes.DateTime,
              description: `DateTime ${UITypes.DateTime}`,
              options: {
                date_format: 'YYYY/MM/DD',
                time_format: 'h:mm:ss',
                '12hr_format': true,
                ...optionsOverride['DateTime'],
              },
            }
          : {
              column_name: 'DateTime',
              title: 'DateTime',
              uidt: UITypes.DateTime,
              meta: {
                date_format: 'YYYY/MM/DD',
                time_format: 'h:mm:ss',
                '12hr_format': true,
                ...optionsOverride['DateTime'],
              },
            },
      ];
    case 'selectBased':
      return [
        isV3
          ? {
              title: 'id',
              type: UITypes.ID,
              description: `id ${UITypes.ID}`,
              options: {
                ...optionsOverride['id'],
              },
            }
          : {
              column_name: 'id',
              title: 'Id',
              uidt: UITypes.ID,
            },
        isV3
          ? {
              title: 'SingleSelect',
              type: UITypes.SingleSelect,
              description: `SingleSelect ${UITypes.SingleSelect}`,
              options: {
                choices: [
                  { title: 'Morning', color: '#122334' },
                  { title: 'Afternoon', color: '#1d2334' },
                  { title: 'Evening', color: '#122f34' },
                  ...(optionsOverride['SingleSelect-ColOptions'] || []),
                ],
                ...optionsOverride['SingleSelect'],
              },
            }
          : {
              column_name: 'SingleSelect',
              title: 'SingleSelect',
              uidt: UITypes.SingleSelect,
              dtxp: "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'",
            },
        isV3
          ? {
              title: 'MultiSelect',
              type: UITypes.MultiSelect,
              description: `MultiSelect ${UITypes.MultiSelect}`,
              options: {
                choices: [
                  { title: 'Morning', color: '#122334' },
                  { title: 'Afternoon', color: '#1d2334' },
                  { title: 'Evening', color: '#122f34' },
                  ...(optionsOverride['MultiSelect-ColOptions'] || []),
                ],
                ...optionsOverride['MultiSelect'],
              },
            }
          : {
              column_name: 'MultiSelect',
              title: 'MultiSelect',
              uidt: UITypes.MultiSelect,
              dtxp: "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'",
          },
      ];
    case 'userBased':
      return [
        isV3
          ? {
              title: 'id',
              type: UITypes.ID,
              description: `id ${UITypes.ID}`,
              options: {
                ...optionsOverride['id'],
              },
            }
          : {
              column_name: 'id',
              title: 'Id',
              uidt: UITypes.ID,
            },
        isV3
          ? {
              title: 'userFieldSingle',
              type: UITypes.User,
              description: `userFieldSingle ${UITypes.User}`,
              options: {
                allow_multiple_users: false,
                notify_when_user_added: true,
                ...optionsOverride['userFieldSingle'],
              },
            }
          : {
              column_name: 'userFieldSingle',
              title: 'userFieldSingle',
              uidt: UITypes.User,
              meta: {
                is_multi: false,
                ...optionsOverride['userFieldSingle'],
              },
            },
        isV3
          ? {
              title: 'userFieldMulti',
              type: UITypes.User,
              description: `userFieldMulti ${UITypes.User}`,
              options: {
                allow_multiple_users: true,
                notify_when_user_added: true,
                ...optionsOverride['userFieldMulti'],
              },
            }
          : {
              column_name: 'userFieldMulti',
              title: 'userFieldMulti',
              uidt: UITypes.User,
              meta: {
                is_multi: true,
                ...optionsOverride['userFieldMulti']
              },
            },
      ];
    case 'aggregationBased':
      return [
        isV3
          ? {
              title: 'Id',
              type: UITypes.ID,
              description: `Id ${UITypes.ID}`,
              options: {
                ...optionsOverride['Id'],
              },
            }
          : {
              column_name: 'Id',
              title: 'Id',
              uidt: UITypes.ID,
              ai: 1,
              pk: 1,
            },
        isV3
          ? {
              title: 'SingleLineText',
              type: UITypes.SingleLineText,
              description: `SingleLineText ${UITypes.SingleLineText}`,
              options: {
                ...optionsOverride['SingleLineText'],
              },
            }
          : {
              column_name: 'SingleLineText',
              title: 'Title',
              uidt: UITypes.SingleLineText,
            },
        isV3
          ? {
              title: 'Attachment',
              type: UITypes.Attachment,
              description: `Attachment ${UITypes.Attachment}`,
              options: {
                ...optionsOverride['Attachment'],
              },
            }
          : {
              column_name: 'Attachment',
              title: 'Attachment',
              uidt: UITypes.Attachment,
            },
        isV3
          ? {
              title: 'User',
              type: UITypes.User,
              description: `User ${UITypes.User}`,
              options: {
                ...optionsOverride['User'],
              },
            }
          : {
              column_name: 'User',
              title: 'User',
              uidt: UITypes.User,
            },
        isV3
          ? {
              title: 'LongText',
              type: UITypes.LongText,
              description: `LongText ${UITypes.LongText}`,
              options: {
                ...optionsOverride['LongText'],
              },
            }
          : {
              column_name: 'LongText',
              title: 'LongText',
              uidt: UITypes.LongText,
            },
        isV3
          ? {
              title: 'Number',
              type: UITypes.Number,
              description: `Number ${UITypes.Number}`,
              options: {
                ...optionsOverride['Number'],
              },
            }
          : {
              column_name: 'Number',
              title: 'Number',
              uidt: UITypes.Number,
            },
        isV3
          ? {
              title: 'Decimal',
              type: UITypes.Decimal,
              description: `Decimal ${UITypes.Decimal}`,
              options: {
                ...optionsOverride['Decimal'],
              },
            }
          : {
              column_name: 'Decimal',
              title: 'Decimal',
              uidt: UITypes.Decimal,
            },
        isV3
          ? {
              title: 'Checkbox',
              type: UITypes.Checkbox,
              description: `Checkbox ${UITypes.Checkbox}`,
              options: {
                ...optionsOverride['Checkbox'],
              },
            }
          : {
              column_name: 'Checkbox',
              title: 'Checkbox',
              uidt: UITypes.Checkbox,
            },
        isV3
          ? {
              title: 'MultiSelect',
              type: UITypes.MultiSelect,
              description: `MultiSelect ${UITypes.MultiSelect}`,
              options: {
                ...optionsOverride['MultiSelect'],
              },
            }
          : {
              column_name: 'MultiSelect',
              title: 'MultiSelect',
              uidt: UITypes.MultiSelect,
              dtxp: "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'",
            },
        isV3
          ? {
              title: 'SingleSelect',
              type: UITypes.SingleSelect,
              description: `SingleSelect ${UITypes.SingleSelect}`,
              options: {
                ...optionsOverride['SingleSelect'],
              },
            }
          : {
              column_name: 'SingleSelect',
              title: 'SingleSelect',
              uidt: UITypes.SingleSelect,
              dtxp: "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'",
            },
        isV3
          ? {
              title: 'Date',
              type: UITypes.Date,
              description: `Date ${UITypes.Date}`,
              options: {
                ...optionsOverride['Date'],
              },
            }
          : {
              column_name: 'Date',
              title: 'Date',
              uidt: UITypes.Date,
            },
        isV3
          ? {
              title: 'DateTime',
              type: UITypes.DateTime,
              description: `DateTime ${UITypes.DateTime}`,
              options: {
                ...optionsOverride['DateTime'],
              },
            }
          : {
              column_name: 'DateTime',
              title: 'DateTime',
              uidt: UITypes.DateTime,
            },
        isV3
          ? {
              title: 'Year',
              type: UITypes.Year,
              description: `Year ${UITypes.Year}`,
              options: {
                ...optionsOverride['Year'],
              },
            }
          : {
              column_name: 'Year',
              title: 'Year',
              uidt: UITypes.Year,
            },
        isV3
          ? {
              title: 'Time',
              type: UITypes.Time,
              description: `Time ${UITypes.Time}`,
              options: {
                ...optionsOverride['Time'],
              },
            }
          : {
              column_name: 'Time',
              title: 'Time',
              uidt: UITypes.Time,
            },
        isV3
          ? {
              title: 'PhoneNumber',
              type: UITypes.PhoneNumber,
              description: `PhoneNumber ${UITypes.PhoneNumber}`,
              options: {
                ...optionsOverride['PhoneNumber'],
              },
            }
          : {
              column_name: 'PhoneNumber',
              title: 'PhoneNumber',
              uidt: UITypes.PhoneNumber,
            },
        isV3
          ? {
              title: 'Email',
              type: UITypes.Email,
              description: `Email ${UITypes.Email}`,
              options: {
                ...optionsOverride['Email'],
              },
            }
          : {
              column_name: 'Email',
              title: 'Email',
              uidt: UITypes.Email,
            },
        isV3
          ? {
              title: 'Url',
              type: UITypes.URL,
              description: `Url ${UITypes.URL}`,
              options: {
                ...optionsOverride['Url'],
              },
            }
          : {
              column_name: 'Url',
              title: 'Url',
              uidt: UITypes.URL,
            },
        isV3
          ? {
              title: 'Currency',
              type: UITypes.Currency,
              description: `Currency ${UITypes.Currency}`,
              options: {
                ...optionsOverride['Currency'],
              },
            }
          : {
              column_name: 'Currency',
              title: 'Currency',
              uidt: UITypes.Currency,
            },
        isV3
          ? {
              title: 'Percent',
              type: UITypes.Percent,
              description: `Percent ${UITypes.Percent}`,
              options: {
                ...optionsOverride['Percent'],
              },
            }
          : {
              column_name: 'Percent',
              title: 'Percent',
              uidt: UITypes.Percent,
            },
        isV3
          ? {
              title: 'Duration',
              type: UITypes.Duration,
              description: `Duration ${UITypes.Duration}`,
              options: {
                ...optionsOverride['Duration'],
              },
            }
          : {
              column_name: 'Duration',
              title: 'Duration',
              uidt: UITypes.Duration,
            },
        isV3
          ? {
              title: 'Rating',
              type: UITypes.Rating,
              description: `Rating ${UITypes.Rating}`,
              options: {
                ...optionsOverride['Rating'],
              },
            }
          : {
              column_name: 'Rating',
              title: 'Rating',
              uidt: UITypes.Rating,
            },
        isV3
          ? {
              title: 'Geometry',
              type: UITypes.Geometry,
              description: `Geometry ${UITypes.Geometry}`,
              options: {
                ...optionsOverride['Geometry'],
              },
            }
          : {
              column_name: 'Geometry',
              title: 'Geometry',
              uidt: UITypes.Geometry,
            },
        isV3
          ? {
              title: 'JSON',
              type: UITypes.JSON,
              description: `JSON ${UITypes.JSON}`,
              options: {
                ...optionsOverride['JSON'],
              },
            }
          : {
              column_name: 'JSON',
              title: 'JSON',
              uidt: UITypes.JSON,
            },
      ];

    case 'custom':
      return [{ title: 'Id', column_name: 'id', uidt: UITypes.ID }, ...options];
  }
};

const createColumn = async (
  context: Context,
  table: Model,
  columnAttr: Record<string, any>,
) => {
  const ctx = {
    workspace_id: table.fk_workspace_id,
    base_id: table.base_id,
  };

  await request(context.app)
    .post(`/api/v1/db/meta/tables/${table.id}/columns`)
    .set('xc-auth', context.token)
    .send({
      ...columnAttr,
    });

  const column: Column = (await table.getColumns(ctx)).find(
    (column) => column.title === columnAttr.title,
  );
  return column;
};

const createRollupColumn = async (
  context: Context,
  {
    base,
    title,
    rollupFunction,
    table,
    relatedTableName,
    relatedTableColumnTitle,
  }: {
    base: Base;
    title: string;
    rollupFunction: string;
    table: Model;
    relatedTableName: string;
    relatedTableColumnTitle: string;
  },
) => {
  const ctx = {
    workspace_id: base.fk_workspace_id,
    base_id: base.id,
  };

  const childBases = await base.getSources();
  const childTable = await Model.getByIdOrName(ctx, {
    base_id: base.id,
    source_id: childBases[0].id!,
    table_name: relatedTableName,
  });
  const childTableColumns = await childTable.getColumns(ctx);
  const childTableColumn = await childTableColumns.find(
    (column) => column.title === relatedTableColumnTitle,
  );

  const ltarColumn = (await table.getColumns(ctx)).find(
    (column) =>
      (column.uidt === UITypes.Links ||
        column.uidt === UITypes.LinkToAnotherRecord) &&
      column.colOptions?.fk_related_model_id === childTable.id,
  );

  const rollupColumn = await createColumn(context, table, {
    title: title,
    uidt: UITypes.Rollup,
    fk_relation_column_id: ltarColumn?.id,
    fk_rollup_column_id: childTableColumn?.id,
    rollup_function: rollupFunction,
    table_name: table.table_name,
    column_name: title,
  });

  return rollupColumn;
};

const createLookupColumn = async (
  context,
  {
    base,
    title,
    table,
    relatedTableName,
    relatedTableColumnTitle,
    relationColumnId,
  }: {
    base: Base;
    title: string;
    table: Model;
    relatedTableName: string;
    relatedTableColumnTitle: string;
    relationColumnId?: string;
  },
) => {
  const ctx = {
    workspace_id: base.fk_workspace_id,
    base_id: base.id,
  };

  const childBases = await base.getSources();
  const childTable = await Model.getByIdOrName(ctx, {
    base_id: base.id,
    source_id: childBases[0].id!,
    table_name: relatedTableName,
  });
  const childTableColumns = await childTable.getColumns(ctx);
  const childTableColumn = await childTableColumns.find(
    (column) => column.title === relatedTableColumnTitle,
  );

  if (!childTableColumn) {
    throw new Error(
      `Could not find column ${relatedTableColumnTitle} in ${relatedTableName}`,
    );
  }

  let ltarColumn;
  if (relationColumnId)
    ltarColumn = (await table.getColumns(ctx)).find(
      (column) => column.id === relationColumnId,
    );
  else {
    ltarColumn = (await table.getColumns(ctx)).find(
      (column) =>
        (column.uidt === UITypes.Links ||
          column.uidt === UITypes.LinkToAnotherRecord) &&
        column.colOptions?.fk_related_model_id === childTable.id,
    );
  }

  const lookupColumn = await createColumn(context, table, {
    title: title,
    uidt: UITypes.Lookup,
    fk_relation_column_id: ltarColumn?.id,
    fk_lookup_column_id: childTableColumn?.id,
    table_name: table.table_name,
    column_name: title,
  });

  return lookupColumn;
};

const createQrCodeColumn = async (
  context,
  {
    title,
    table,
    referencedQrValueTableColumnTitle,
  }: {
    title: string;
    table: Model;
    referencedQrValueTableColumnTitle: string;
  },
) => {
  const ctx = {
    workspace_id: table.fk_workspace_id,
    base_id: table.base_id,
  };

  const columns = await table.getColumns(ctx);
  const referencedQrValueTableColumnId = columns.find(
    (column) => column.title == referencedQrValueTableColumnTitle,
  )['id'];

  const qrCodeColumn = await createColumn(context, table, {
    title: title,
    uidt: UITypes.QrCode,
    column_name: title,
    fk_qr_value_column_id: referencedQrValueTableColumnId,
  });
  return qrCodeColumn;
};

const createBarcodeColumn = async (
  context,
  {
    title,
    table,
    referencedBarcodeValueTableColumnTitle,
  }: {
    title: string;
    table: Model;
    referencedBarcodeValueTableColumnTitle: string;
  },
) => {
  const referencedBarcodeValueTableColumnId = await table
    .getColumns({
      workspace_id: table.fk_workspace_id,
      base_id: table.base_id,
    })
    .then(
      (cols) =>
        cols.find(
          (column) => column.title == referencedBarcodeValueTableColumnTitle,
        )['id'],
    );

  const barcodeColumn = await createColumn(context, table, {
    title: title,
    uidt: UITypes.Barcode,
    column_name: title,
    fk_barcode_value_column_id: referencedBarcodeValueTableColumnId,
  });
  return barcodeColumn;
};

const createLtarColumn = async (
  context,
  {
    title,
    parentTable,
    childTable,
    type,
  }: {
    title: string;
    parentTable: Model;
    childTable: Model;
    type: string;
  },
) => {
  const ltarColumn = await createColumn(context, parentTable, {
    title: title,
    column_name: title,
    uidt: UITypes.Links,
    parentId: parentTable.id,
    childId: childTable.id,
    type: type,
  });

  return ltarColumn;
};

const updateGridViewColumn = async (
  context,
  {
    view,
    column,
    attr,
  }: {
    column: GridViewColumn;
    view: View;
    attr: any;
  },
) => {
  const ctx = {
    workspace_id: view.fk_workspace_id,
    base_id: view.base_id,
  };

  const res = await request(context.app)
    .patch(`/api/v1/db/meta/grid-columns/${column.id}`)
    .set('xc-auth', context.token)
    .expect(200)
    .send(attr);

  const updatedColumn = (await view.getColumns(ctx)).find(
    (col) => col.id === column.id,
  );

  return updatedColumn;
};

const updateViewColumn = async (
  context,
  { view, column, attr }: { column: Column; view: View; attr: any },
) => {
  const ctx = {
    workspace_id: view.fk_workspace_id,
    base_id: view.base_id,
  };

  const res = await request(context.app)
    .patch(`/api/v1/db/meta/views/${view.id}/columns/${column.id}`)
    .set('xc-auth', context.token)
    .send({
      ...attr,
    });

  const updatedColumn: FormViewColumn | GridViewColumn | GalleryViewColumn = (
    await view.getColumns(ctx)
  ).find((column) => column.id === column.id)!;

  return updatedColumn;
};

const updateColumn = async (
  context,
  { table, column, attr }: { column: Column; table: Model; attr: any },
) => {
  const ctx = {
    workspace_id: table.fk_workspace_id,
    base_id: table.base_id,
  };

  const res = await request(context.app)
    .patch(`/api/v2/meta/columns/${column.id}`)
    .set('xc-auth', context.token)
    .send({
      ...attr,
    });

  const updatedColumn: Column = (await table.getColumns(ctx)).find(
    (column) => column.id === column.id,
  );
  return updatedColumn;
};

const deleteColumn = async (
  context,
  { table, column }: { column: Column; table: Model },
) => {
  const res = await request(context.app)
    .delete(`/api/v2/meta/columns/${column.id}`)
    .set('xc-auth', context.token)
    .send({})
    .expect(200);
};

export {
  customColumns,
  defaultColumns,
  createColumn,
  createQrCodeColumn,
  createBarcodeColumn,
  createRollupColumn,
  createLookupColumn,
  createLtarColumn,
  updateGridViewColumn,
  updateViewColumn,
  updateColumn,
  deleteColumn,
};
