import { expect } from 'chai';
import { UITypes } from 'nocodb-sdk';
import Column from '../../../../lib/models/Column';

describe('Column', () => {
  describe('isSystemColumnExceptForeignKey', () => {
    describe('when column is system column except foreign key', () => {
      it('returns true', () => {
        const column = new Column({
          uidt: UITypes.DateTime,
          title: 'CreatedAt',
          column_name: 'created_at',
        });
        expect(column.isSystemColumnExceptForeignKey()).to.be.true;
      });
    });

    describe('when column is a system column but is a foreign key', () => {
      it('returns false', () => {
        const column = new Column({
          uidt: UITypes.ForeignKey,
          title: 'foreign_key',
          column_name: 'foreign_key',
        });
        expect(column.isSystemColumnExceptForeignKey()).to.be.false;
      });
    });

    describe('when column is not a system column', () => {
      it('returns false', () => {
        const column = new Column({
          uidt: UITypes.DateTime,
          title: 'not_a_system_column',
          column_name: 'not_a_system_column',
        });
        expect(column.isSystemColumnExceptForeignKey()).to.be.false;
      });
    });
  });
});
