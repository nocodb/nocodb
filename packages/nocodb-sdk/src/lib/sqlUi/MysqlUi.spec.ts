import { MysqlUi } from './MysqlUi';

describe('MysqlUi', () => {
  describe('adjustLengthAndScale', () => {
    it('will set default length on new table and no scale', () => {
      const sqlUi = new MysqlUi();
      const newColumn = {
        dt: 'decimal',
        dtxs: undefined,
        dtxp: undefined,
      };
      sqlUi.adjustLengthAndScale(newColumn);
      expect(newColumn.dtxp).toBe(10);
      expect(newColumn.dtxs).toBe(2);
    });
    it('will set old column length with no scale', () => {
      const sqlUi = new MysqlUi();
      const oldColumn = {
        dt: 'decimal',
        dtxs: '2',
        dtxp: 11,
      };
      const newColumn = {
        dt: 'decimal',
        dtxs: undefined,
        dtxp: undefined,
      };
      sqlUi.adjustLengthAndScale(newColumn, oldColumn);
      expect(newColumn.dtxp).toBe(11);
      expect(newColumn.dtxs).toBe(2);
    });
    it('will set new column length with scale', () => {
      const sqlUi = new MysqlUi();
      const oldColumn = {
        dt: 'decimal',
        dtxs: '2',
        dtxp: 11,
      };
      const newColumn = {
        dt: 'decimal',
        dtxs: 5,
        dtxp: undefined,
      };
      sqlUi.adjustLengthAndScale(newColumn, oldColumn);
      expect(newColumn.dtxp).toBe(13);
      expect(newColumn.dtxs).toBe(5);
    });
  });
});
