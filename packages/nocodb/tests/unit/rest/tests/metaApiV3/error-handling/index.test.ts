import baseTestV3 from './base.test';
import tableTestV3 from './table.test';
import columnTestV3 from './column.test';
import viewTestV3 from './view.test';

export default function () {
  baseTestV3();
  tableTestV3();
  columnTestV3();
  viewTestV3();
}
