// Mock heavy dependencies before any imports so jest.mock hoisting works correctly.
jest.mock('~/models', () => ({
  View: { getColumns: jest.fn() },
  Column: class { },
  Model: class { },
  Sort: class { },
  Source: class { },
}));

jest.mock('~/utils/common/NcConnectionMgrv2', () => ({
  default: {},
}));

jest.mock('~/utils', () => ({
  excludeAttachmentProps: (obj: unknown) => obj,
}));

import type { NcContext } from 'nocodb-sdk';
import { UITypes } from 'nocodb-sdk';
import { getQueriedColumns } from './dbHelpers';
import { View } from '~/models';

const mockViewGetColumns = View.getColumns as jest.Mock;

describe('getQueriedColumns – empty table CSV export', () => {
  const context: NcContext = {
    workspace_id: 'ws1',
    base_id: 'base1',
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should preserve view column order for empty table CSV export', async () => {
    // DB order (natural order)
    const dbColumns = [
      { id: 'col-1', title: 'Name', uidt: UITypes.SingleLineText },
      { id: 'col-2', title: 'Age', uidt: UITypes.Number },
      { id: 'col-3', title: 'Email', uidt: UITypes.Email },
    ];

    // UI view order (dragged by user)
    mockViewGetColumns.mockResolvedValue([
      { fk_column_id: 'col-2' },
      { fk_column_id: 'col-1' },
      { fk_column_id: 'col-3' },
    ]);

    const model = {
      getColumns: jest.fn().mockResolvedValue(dbColumns),
    } as any;

    const view = {
      id: 'view-1',
    } as any;

    const result = await getQueriedColumns(context, {
      model,
      view,
      fieldsSet: new Set(['col-1', 'col-2', 'col-3']),
    });

    expect(result.map((c: any) => c.title)).toEqual([
      'Age',
      'Name',
      'Email',
    ]);
  });
});