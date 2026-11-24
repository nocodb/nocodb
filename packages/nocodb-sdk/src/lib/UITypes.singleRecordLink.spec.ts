import type { ColumnType } from './Api';
import { LinksVersion, RelationTypes } from './globals';
import UITypes, {
  isSingleRecordLinkColumn,
  isSupportedDisplayValueColumn,
} from './UITypes';

const link = (
  uidt: UITypes,
  type: RelationTypes,
  version?: LinksVersion,
  meta?: any
) =>
  ({
    uidt,
    meta,
    colOptions: { type, version },
  } as unknown as ColumnType);

describe('isSingleRecordLinkColumn', () => {
  it('accepts V1 belongs-to', () => {
    expect(
      isSingleRecordLinkColumn(
        link(UITypes.LinkToAnotherRecord, RelationTypes.BELONGS_TO)
      )
    ).toBe(true);
  });

  it('accepts V1 one-to-one only on the side that holds the FK', () => {
    expect(
      isSingleRecordLinkColumn(
        link(UITypes.LinkToAnotherRecord, RelationTypes.ONE_TO_ONE, undefined, {
          bt: true,
        })
      )
    ).toBe(true);
    expect(
      isSingleRecordLinkColumn(
        link(UITypes.LinkToAnotherRecord, RelationTypes.ONE_TO_ONE)
      )
    ).toBe(false);
  });

  it('accepts V2 many-to-one, one-to-one and belongs-to for both link uidts', () => {
    for (const uidt of [UITypes.LinkToAnotherRecord, UITypes.Links]) {
      for (const type of [
        RelationTypes.MANY_TO_ONE,
        RelationTypes.ONE_TO_ONE,
        RelationTypes.BELONGS_TO,
      ]) {
        expect(
          isSingleRecordLinkColumn(link(uidt, type, LinksVersion.V2))
        ).toBe(true);
      }
    }
  });

  it('accepts V2 relation versions stored as a string', () => {
    expect(
      isSingleRecordLinkColumn(
        link(
          UITypes.Links,
          RelationTypes.MANY_TO_ONE,
          '2' as unknown as LinksVersion
        )
      )
    ).toBe(true);
  });

  it('rejects has-many, many-to-many and one-to-many in both versions', () => {
    for (const type of [
      RelationTypes.HAS_MANY,
      RelationTypes.MANY_TO_MANY,
      RelationTypes.ONE_TO_MANY,
    ]) {
      expect(
        isSingleRecordLinkColumn(link(UITypes.LinkToAnotherRecord, type))
      ).toBe(false);
      expect(
        isSingleRecordLinkColumn(
          link(UITypes.LinkToAnotherRecord, type, LinksVersion.V2)
        )
      ).toBe(false);
    }
  });

  it('rejects V1 Links, which render as a count', () => {
    expect(
      isSingleRecordLinkColumn(link(UITypes.Links, RelationTypes.BELONGS_TO))
    ).toBe(false);
  });

  it('rejects columns without colOptions and non-link columns', () => {
    expect(
      isSingleRecordLinkColumn({
        uidt: UITypes.LinkToAnotherRecord,
      } as ColumnType)
    ).toBe(false);
    expect(
      isSingleRecordLinkColumn({ uidt: UITypes.SingleLineText } as ColumnType)
    ).toBe(false);
    expect(isSingleRecordLinkColumn(undefined)).toBe(false);
  });
});

describe('isSupportedDisplayValueColumn with allowSingleRecordLink', () => {
  const bt = link(UITypes.LinkToAnotherRecord, RelationTypes.BELONGS_TO);
  const mm = link(UITypes.LinkToAnotherRecord, RelationTypes.MANY_TO_MANY);

  it('keeps rejecting links by default', () => {
    expect(isSupportedDisplayValueColumn(bt)).toBe(false);
  });

  it('allows only single-record links when asked', () => {
    const opts = { allowSingleRecordLink: true };
    expect(isSupportedDisplayValueColumn(bt, opts)).toBe(true);
    expect(isSupportedDisplayValueColumn(mm, opts)).toBe(false);
    expect(
      isSupportedDisplayValueColumn(
        { uidt: UITypes.SingleLineText } as ColumnType,
        opts
      )
    ).toBe(true);
  });
});
