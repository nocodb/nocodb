import { ncIsString, RelationTypes, UITypes } from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import type {
  LinkToAnotherRecordColumn,
  LookupColumn,
  SelectOption,
} from '~/models';
import type { NcContext } from '~/interface/config';
import { Column, Model, View } from '~/models';
import { sanitizeUserForHook } from '~/helpers/webhookHelpers';
import { isEE } from '~/utils';

export async function populateSamplePayload(
  context: NcContext,
  viewOrModel: View | Model,
  includeNested = false,
  operation = 'insert',
) {
  const out = {};
  let columns: Column[] = [];
  let model: Model;
  if (viewOrModel instanceof View) {
    const viewColumns = await viewOrModel.getColumns(context);
    for (const col of viewColumns) {
      if (col.show)
        columns.push(await Column.get(context, { colId: col.fk_column_id }));
    }
    model = await viewOrModel.getModel(context);
    await model.getColumns(context);
  } else if (viewOrModel instanceof Model) {
    columns = await viewOrModel.getColumns(context);
    model = viewOrModel;
  }

  for (const column of columns) {
    if (
      !includeNested &&
      [UITypes.LinkToAnotherRecord, UITypes.Lookup].includes(column.uidt)
    )
      continue;

    if (operation === 'delete' && model.primaryKey?.title !== column.title)
      continue;

    out[column.title] = await getSampleColumnValue(context, column);
  }

  return out;
}

export interface SampleUser {
  id: string;
  email: string;
  display_name: string;
  user_name: string;
  roles?: string | Record<string, any>;
}

export async function populateSamplePayloadV2(
  context: NcContext,
  viewOrModel: View | Model,
  includeNested = false,
  operation = 'insert',
  scope = 'records',
  includeUser = false,
  user?: SampleUser,
  version = 'v2',
) {
  const rows = {};
  let columns: Column[] = [];
  let model: Model;
  if (viewOrModel instanceof View) {
    const viewColumns = await viewOrModel.getColumns(context);
    for (const col of viewColumns) {
      if (col.show)
        columns.push(await Column.get(context, { colId: col.fk_column_id }));
    }
    model = await viewOrModel.getModel(context);
    await model.getColumns(context);
  } else if (viewOrModel instanceof Model) {
    columns = await viewOrModel.getColumns(context);
    model = viewOrModel;
  }

  await model.getViews(context);

  if (ncIsString(operation) && version === 'v3') {
    operation = operation.replace('bulk', '').toLowerCase();
  }

  const sampleUser = includeUser
    ? user || {
        id: 'usr_sample_user_id',
        email: 'user@example.com',
        display_name: 'Sample User',
        user_name: 'sample_user',
        roles: 'user',
      }
    : null;

  const samplePayload = {
    type: `${scope}.after.${operation}`,
    id: uuidv4(),
    ...(includeUser && isEE && sampleUser
      ? { user: sanitizeUserForHook(sampleUser) }
      : {}),
    ...(version === 'v3' ? { version } : {}),
    data: {
      table_id: model.id,
      table_name: model.title,
    },
  };

  for (const column of columns) {
    if (
      !includeNested &&
      [UITypes.LinkToAnotherRecord, UITypes.Lookup].includes(column.uidt)
    )
      continue;

    rows[column.title] = await getSampleColumnValue(context, column);
  }

  let prevRows;
  if (
    ['update', ...(version === 'v2' ? ['bulkUpdate'] : [])].includes(operation)
  ) {
    prevRows = rows;
  }

  samplePayload.data = {
    ...samplePayload.data,
    ...(prevRows && { previous_rows: [prevRows] }),
    ...(operation !== 'bulkInsert' && rows && { rows: [rows] }),
    ...(operation === 'bulkInsert' &&
      rows && {
        row_inserted: 10,
      }),
  };

  return samplePayload;
}

async function getSampleColumnValue(
  context: NcContext,
  column: Column,
): Promise<any> {
  switch (column.uidt) {
    case UITypes.ID:
      {
        return 1;
      }
      break;
    case UITypes.LinkToAnotherRecord:
      {
        const colOpt = await column.getColOptions<LinkToAnotherRecordColumn>(
          context,
        );
        const sampleVal = await populateSamplePayload(
          context,
          await colOpt.getRelatedTable(context),
        );
        if (colOpt.type !== RelationTypes.BELONGS_TO) {
          return undefined;
        }
        return colOpt.type === RelationTypes.BELONGS_TO
          ? sampleVal
          : [sampleVal];
      }
      break;
    case UITypes.ForeignKey:
      {
        return 1;
      }
      break;
    case UITypes.Lookup:
      {
        const colOpt = await column.getColOptions<LookupColumn>(context);
        const relColOpt = await colOpt
          .getRelationColumn(context)
          .then((r) => r.getColOptions<LinkToAnotherRecordColumn>(context));
        const { refContext } = relColOpt.getRelContext(context);
        const sampleVal = await getSampleColumnValue(
          context,
          await colOpt.getLookupColumn(refContext),
        );
        return relColOpt.type === RelationTypes.BELONGS_TO
          ? sampleVal
          : [sampleVal].flat();
      }
      break;
    case UITypes.SingleLineText:
      {
        return 'Sample Text';
      }
      break;
    case UITypes.LongText:
      {
        return 'Sample Long text';
      }
      break;
    case UITypes.Attachment:
      {
        return [
          {
            url: 'https://nocodb.com/dummy.png',
            title: 'image.png',
            mimetype: 'image/png',
            size: 0,
          },
        ];
      }
      break;
    case UITypes.Checkbox:
      {
        return true;
      }
      break;
    case UITypes.MultiSelect:
      {
        const colOpt = await column.getColOptions<SelectOption[]>(context);
        return (
          colOpt?.[0]?.title ||
          column?.dtxp?.split(',')?.[0]?.replace(/^['"]|['"]$/g, '')
        );
      }
      break;
    case UITypes.SingleSelect:
      {
        const colOpt = await column.getColOptions<SelectOption[]>(context);
        return (
          colOpt?.[0]?.title ||
          column?.dtxp?.split(',')?.[0]?.replace(/^['"]|['"]$/g, '')
        );
      }
      break;
    case UITypes.Date:
      {
        return new Date();
      }
      break;
    case UITypes.Year:
      {
        return 2000;
      }
      break;
    case UITypes.Time:
      {
        return '11:00';
      }
      break;
    case UITypes.PhoneNumber:
      {
        return '0000000000';
      }
      break;
    case UITypes.Email:
      {
        return 'test@nocodb.com';
      }
      break;
    case UITypes.URL:
      {
        return 'https://nocodb.com';
      }
      break;
    case UITypes.Number:
      {
        return 123;
      }
      break;
    case UITypes.Decimal:
      {
        return 123.1;
      }
      break;
    case UITypes.Currency:
      {
        return '$123';
      }
      break;
    case UITypes.Percent:
      {
        return '10';
      }
      break;
    case UITypes.Duration:
      {
        return 123;
      }
      break;
    case UITypes.Rating:
      {
        return 1;
      }
      break;
    case UITypes.Formula:
      {
        return 'Sample Output';
      }
      break;
    case UITypes.Rollup:
      {
        return 1;
      }
      break;
    case UITypes.Count:
      {
        return 1;
      }
      break;
    case UITypes.DateTime:
      {
        return new Date();
      }
      break;
    case UITypes.CreatedTime:
      {
        return new Date();
      }
      break;
    case UITypes.LastModifiedTime:
      {
        return new Date();
      }
      break;
    case UITypes.AutoNumber:
      {
        return 1;
      }
      break;
    case UITypes.Geometry:
      {
        return {};
      }
      break;
    case UITypes.JSON:
      {
        return '{}';
      }
      break;
    case UITypes.SpecificDBType:
      {
        return null;
      }
      break;
    case UITypes.User:
      {
        return [
          {
            id: 'u8z87rijgdsrpzdrbqsw',
            email: 'user@example.com',
            display_name: 'User',
            meta: {
              icon: {
                url: 'https://cdn.mysite.example/image/sAlPwL3wqYPg74H7TMPb.webp',
                title: 'sAlPwL3wqYPg74H7TMPb.webp',
                mimetype: 'image/webp',
                size: 26662,
                width: 270,
                height: 370,
                signedUrl:
                  'https://cdn.mysite.example/image/sAlPwL3wqYPg74H7TMPb.webp',
                data: '',
              },
              iconType: 'IMAGE',
            },
          },
        ];
      }
      break;
    case UITypes.GeoData:
      {
        return '51.50073334463501;-0.12462623347869291';
      }
      break;
  }
}
