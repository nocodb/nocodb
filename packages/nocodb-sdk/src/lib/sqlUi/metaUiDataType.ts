import UITypes from '../UITypes';

/**
 * Maps a NocoDB "abstract type" to the UIType assigned when introspecting an
 * EXISTING DB column during meta-sync / meta-diff.
 *
 * This is the exact map the (now-removed) `ModelXcMeta*.getUIDataType` classes
 * used, relocated here so meta-sync output is byte-for-byte unchanged.
 *
 * IMPORTANT: this intentionally differs from `SqlUi.getUIType` (the
 * column-CREATION default). The introspection map keeps:
 *   datetime → DateTime   (not CreatedTime)
 *   json     → JSON        (LongText for SQLite — pass `jsonAsLongText`)
 *   blob     → LongText    (not Attachment)
 *   geometry → Geometry
 *   unknown  → SpecificDBType (not SingleLineText)
 */
export function abstractTypeToMetaUIType(
  abstractType: string,
  opts?: { jsonAsLongText?: boolean },
): UITypes {
  switch (abstractType) {
    case 'integer':
      return UITypes.Number;
    case 'boolean':
      return UITypes.Checkbox;
    case 'float':
      return UITypes.Decimal;
    case 'date':
      return UITypes.Date;
    case 'datetime':
      return UITypes.DateTime;
    case 'time':
      return UITypes.Time;
    case 'year':
      return UITypes.Year;
    case 'string':
      return UITypes.SingleLineText;
    case 'text':
      return UITypes.LongText;
    case 'enum':
      return UITypes.SingleSelect;
    case 'set':
      return UITypes.MultiSelect;
    case 'json':
      return opts?.jsonAsLongText ? UITypes.LongText : UITypes.JSON;
    case 'blob':
      return UITypes.LongText;
    case 'geometry':
      return UITypes.Geometry;
    default:
      return UITypes.SpecificDBType;
  }
}
