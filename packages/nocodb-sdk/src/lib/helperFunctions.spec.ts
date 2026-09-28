import UITypes from './UITypes';
import { isRollupAggregatableColumn } from './helperFunctions';

describe('isRollupAggregatableColumn', () => {
  it('accepts physical columns', () => {
    for (const uidt of [
      UITypes.SingleLineText,
      UITypes.Number,
      UITypes.Attachment,
      UITypes.SingleSelect,
      UITypes.Checkbox,
    ]) {
      expect(isRollupAggregatableColumn({ uidt })).toBe(true);
    }
  });

  it('accepts the virtual types the rollup query builder lowers to a subquery', () => {
    for (const uidt of [
      UITypes.Formula,
      UITypes.Rollup,
      UITypes.CreatedTime,
      UITypes.CreatedBy,
      UITypes.LastModifiedTime,
      UITypes.LastModifiedBy,
    ]) {
      expect(isRollupAggregatableColumn({ uidt })).toBe(true);
    }
  });

  it('rejects virtual types that have no underlying column to aggregate', () => {
    for (const uidt of [
      UITypes.LinkToAnotherRecord,
      UITypes.Links,
      UITypes.Lookup,
      UITypes.Barcode,
      UITypes.QrCode,
      UITypes.Button,
    ]) {
      expect(isRollupAggregatableColumn({ uidt })).toBe(false);
    }
  });

  it('accepts a bare UIType as well as a column', () => {
    expect(isRollupAggregatableColumn(UITypes.Number)).toBe(true);
    expect(isRollupAggregatableColumn(UITypes.Lookup)).toBe(false);
  });
});
