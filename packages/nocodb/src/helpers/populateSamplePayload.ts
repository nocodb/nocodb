import { RelationTypes, UITypes } from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import type {
  LinkToAnotherRecordColumn,
  LookupColumn,
  SelectOption,
} from '~/models';
import { Column, Model, View } from '~/models';

export async function populateSamplePayload(
  viewOrModel: View | Model,
  includeNested = false,
  operation = 'insert',
) {
  const out = {};
  let columns: Column[] = [];
  let model: Model;
  if (viewOrModel instanceof View) {
    const viewColumns = await viewOrModel.getColumns();
    for (const col of viewColumns) {
      if (col.show) columns.push(await Column.get({ colId: col.fk_column_id }));
    }
    model = await viewOrModel.getModel();
    await model.getColumns();
  } else if (viewOrModel instanceof Model) {
    columns = await viewOrModel.getColumns();
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

    out[column.title] = await getSampleColumnValue(column);
  }

  return out;
}

export async function populateSamplePayloadV2(
  viewOrModel: View | Model,
  includeNested = false,
  operation = 'insert',
  scope = 'records',
) {
  const rows = {};
  let columns: Column[] = [];
  let model: Model;
  if (viewOrModel instanceof View) {
    const viewColumns = await viewOrModel.getColumns();
    for (const col of viewColumns) {
      if (col.show) columns.push(await Column.get({ colId: col.fk_column_id }));
    }
    model = await viewOrModel.getModel();
    await model.getColumns();
  } else if (viewOrModel instanceof Model) {
    columns = await viewOrModel.getColumns();
    model = viewOrModel;
  }

  await model.getViews();

  const samplePayload = {
    type: `${scope}.after.${operation}`,
    id: uuidv4(),
    data: {
      table_id: model.id,
      table_name: model.title,
      view_id: model.views[0].id,
      view_name: model.views[0].title,
    },
  };

  for (const column of columns) {
    if (
      !includeNested &&
      [UITypes.LinkToAnotherRecord, UITypes.Lookup].includes(column.uidt)
    )
      continue;

    rows[column.title] = await getSampleColumnValue(column);
  }

  let prevRows;
  if (['update', 'bulkUpdate'].includes(operation)) {
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

async function getSampleColumnValue(column: Column): Promise<any> {
  switch (column.uidt) {
    case UITypes.ID:
      {
        return 1;
      }
      break;
    case UITypes.LinkToAnotherRecord:
      {
        const colOpt = await column.getColOptions<LinkToAnotherRecordColumn>();
        const sampleVal = await populateSamplePayload(
          await colOpt.getRelatedTable(),
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
        const colOpt = await column.getColOptions<LookupColumn>();
        const relColOpt = await colOpt
          .getRelationColumn()
          .then((r) => r.getColOptions<LinkToAnotherRecordColumn>());
        const sampleVal = await getSampleColumnValue(
          await colOpt.getLookupColumn(),
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
        const colOpt = await column.getColOptions<SelectOption[]>();
        return (
          colOpt?.[0]?.title ||
          column?.dtxp?.split(',')?.[0]?.replace(/^['"]|['"]$/g, '')
        );
      }
      break;
    case UITypes.SingleSelect:
      {
        const colOpt = await column.getColOptions<SelectOption[]>();
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
    case UITypes.CreateTime:
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
  }
}
