import { BelongsToHelper } from './BelongsTo';
import { ManyToManyHelper } from './ManyToMany';
import { LinksHelper } from '../Links';
import { SilentTypeConversionError } from '~/lib/error';
import UITypes from '~/lib/UITypes';
import { ColumnType, TableType } from '~/lib/Api';

/**
 * LTAR clipboard round-trip — the text/plain side is the human-readable
 * display value; the lossless envelope rides `params.clipboardItem`
 * (in-app copies), with the legacy JSON-envelope text still accepted.
 */
describe('LTAR clipboard serialization', () => {
  const RELATED_MODEL_ID = 'md_orders';
  const BASE_ID = 'p_base';

  const relatedMeta = {
    id: RELATED_MODEL_ID,
    base_id: BASE_ID,
    columns: [
      { id: 'cl_pk', title: 'Id', pk: true, uidt: UITypes.ID },
      {
        id: 'cl_order_id',
        title: 'order_id',
        pv: true,
        uidt: UITypes.SingleLineText,
      },
    ],
  } as TableType;

  const metas = { [RELATED_MODEL_ID]: relatedMeta } as Record<
    string,
    TableType
  >;

  const meta = { id: 'md_returns', base_id: BASE_ID } as TableType;

  const btCol = {
    id: 'cl_bt',
    title: 'Order',
    uidt: UITypes.LinkToAnotherRecord,
    colOptions: { type: 'bt', fk_related_model_id: RELATED_MODEL_ID },
  } as ColumnType;

  const mmLinksCol = {
    id: 'cl_mm',
    title: 'Orders',
    uidt: UITypes.Links,
    colOptions: { type: 'mm', fk_related_model_id: RELATED_MODEL_ID },
  } as ColumnType;

  const baseParams = { meta, metas } as any;

  describe('parseValue (copy → text/plain)', () => {
    it('BT copies the display value, not the JSON envelope', () => {
      const value = { Id: 1, order_id: '702-4787840-9226625' };

      expect(
        new BelongsToHelper().parseValue(value, { ...baseParams, col: btCol })
      ).toBe('702-4787840-9226625');
    });

    it('MM (LTAR) copies joined display values', () => {
      const value = [
        { Id: 1, order_id: 'A-1' },
        { Id: 2, order_id: 'A-2' },
      ];
      const mmLtarCol = {
        ...btCol,
        colOptions: { type: 'mm', fk_related_model_id: RELATED_MODEL_ID },
      } as ColumnType;

      expect(
        new ManyToManyHelper().parseValue(value, {
          ...baseParams,
          col: mmLtarCol,
        })
      ).toBe('A-1, A-2');
    });

    it('Links (count) copies the rendered count text', () => {
      expect(
        new LinksHelper().parseValue(3, {
          ...baseParams,
          col: mmLinksCol,
          rowId: 'r1',
        })
      ).toBe('3 Links');
    });
  });

  describe('serializeValue (paste)', () => {
    it('BT reconstructs the envelope from a matching clipboard item', () => {
      const dbCellValue = { Id: 1, order_id: '702-4787840-9226625' };

      const result = new BelongsToHelper().serializeValue(
        '702-4787840-9226625',
        {
          ...baseParams,
          col: btCol,
          clipboardItem: { rowId: 'r9', dbCellValue, column: btCol },
        }
      );

      expect(result).toEqual({
        fk_related_model_id: RELATED_MODEL_ID,
        value: dbCellValue,
      });
    });

    it('BT rejects a clipboard item from a different related table', () => {
      const foreignCol = {
        ...btCol,
        colOptions: { type: 'bt', fk_related_model_id: 'md_other' },
      } as ColumnType;

      expect(() =>
        new BelongsToHelper().serializeValue('whatever', {
          ...baseParams,
          col: btCol,
          clipboardItem: {
            rowId: 'r9',
            dbCellValue: { Id: 1 },
            column: foreignCol,
          },
        })
      ).toThrow(SilentTypeConversionError);
    });

    it('BT still accepts the legacy JSON-envelope text', () => {
      const text = JSON.stringify({
        fk_related_model_id: RELATED_MODEL_ID,
        value: { Id: 1, order_id: 'A-1' },
      });

      expect(
        new BelongsToHelper().serializeValue(text, {
          ...baseParams,
          col: btCol,
        })
      ).toEqual({
        fk_related_model_id: RELATED_MODEL_ID,
        value: { Id: 1, order_id: 'A-1' },
      });
    });

    it('BT rejects plain display-value text without a clipboard item', () => {
      expect(() =>
        new BelongsToHelper().serializeValue('702-4787840-9226625', {
          ...baseParams,
          col: btCol,
        })
      ).toThrow(SilentTypeConversionError);
    });

    it('Links reconstructs the source identity from a matching clipboard item', () => {
      const result = new LinksHelper().serializeValue('3 Links', {
        ...baseParams,
        col: mmLinksCol,
        clipboardItem: { rowId: 'r5', dbCellValue: 3, column: mmLinksCol },
      });

      expect(result).toEqual({
        rowId: 'r5',
        columnId: 'cl_mm',
        fk_related_model_id: RELATED_MODEL_ID,
        value: 3,
      });
    });

    it('Links rejects a single-link (bt) clipboard item', () => {
      expect(() =>
        new LinksHelper().serializeValue('A-1', {
          ...baseParams,
          col: mmLinksCol,
          clipboardItem: { rowId: 'r5', dbCellValue: { Id: 1 }, column: btCol },
        })
      ).toThrow(SilentTypeConversionError);
    });
  });
});
