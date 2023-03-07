import View from '../../models/View';
import Column from '../../models/Column';
import { RelationTypes, UITypes } from 'nocodb-sdk';
import Model from '../../models/Model';
import type LinkToAnotherRecordColumn from '../../models/LinkToAnotherRecordColumn';
import type LookupColumn from '../../models/LookupColumn';
import type SelectOption from '../../models/SelectOption';

export default async function populateSamplePayload(
  viewOrModel: View | Model,
  includeNested = false,
  operation = 'insert'
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
          await colOpt.getRelatedTable()
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
          await colOpt.getLookupColumn()
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
