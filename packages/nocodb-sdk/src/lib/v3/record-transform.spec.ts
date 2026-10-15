import UITypes from '../UITypes';
import { recordV2ToV3 } from './record-transform';
import type { ModelMeta, RecordColumnMeta } from './record-transform';

const parentPk: RecordColumnMeta = { id: 'p_id', title: 'Id', pk: true };
const childPk: RecordColumnMeta = { id: 'c_id', title: 'Id', pk: true };
const childName: RecordColumnMeta = { id: 'c_name', title: 'Name', pv: true };
const childNotes: RecordColumnMeta = { id: 'c_notes', title: 'Notes' };

const child: ModelMeta = {
  id: 'm_child',
  title: 'Child',
  primaryKeys: [childPk],
  columns: [childPk, childName, childNotes],
};

const parentColumns: RecordColumnMeta[] = [
  parentPk,
  { id: 'p_title', title: 'Title', pv: true },
  { id: 'p_link', title: 'Children', uidt: UITypes.LinkToAnotherRecord },
  { id: 'p_owner', title: 'Owner', uidt: UITypes.LinkToAnotherRecord },
];

const transform = (requestedFields?: string[]) =>
  recordV2ToV3(
    {
      Id: 1,
      Title: 'Parent',
      Children: [{ Id: 10, Name: 'Ada', Notes: 'x' }],
      Owner: { Id: 11, Name: 'Grace', Notes: 'y' },
    },
    {
      primaryKeys: [parentPk],
      columns: parentColumns,
      requestedFields,
      modelMap: { m_child: child },
      columnModelMap: { p_link: 'm_child', p_owner: 'm_child' },
    }
  );

describe('recordV2ToV3 nested requestedFields', () => {
  it('keeps the linked display value when the parent narrows fields', () => {
    const { fields } = transform(['Children', 'Owner']);
    expect(fields).toEqual({
      Children: [{ id: 10, id_fields: { Id: 10 }, fields: { Name: 'Ada' } }],
      Owner: { id: 11, id_fields: { Id: 11 }, fields: { Name: 'Grace' } },
    });
  });

  it('passes every nested field through when the parent does not narrow', () => {
    const { fields } = transform();
    expect(fields.Children[0].fields).toEqual({ Name: 'Ada', Notes: 'x' });
  });
});
