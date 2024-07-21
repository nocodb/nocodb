import BasePage from '../../Base';
import { GridPage } from './index';

export class AggregaionBarPage extends BasePage {
  readonly parent: GridPage;

  constructor(parent: GridPage) {
    super(parent.rootPage);
    this.parent = parent;
  }
}
