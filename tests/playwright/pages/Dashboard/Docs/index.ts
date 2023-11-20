import { DashboardPage } from '..';
import { DocsOpenedPagePage } from './OpenedPage';
import { DocsPageListPage } from './PagesList';

export class DocsPageGroup {
  readonly pagesList: DocsPageListPage;
  readonly openedPage: DocsOpenedPagePage;

  constructor(dashboard: DashboardPage) {
    this.pagesList = new DocsPageListPage(dashboard);
    this.openedPage = new DocsOpenedPagePage(dashboard);
  }
}
