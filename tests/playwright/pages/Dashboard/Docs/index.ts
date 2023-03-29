import { DashboardPage } from '..';
import { DocsPageListPage } from './PagesList';

export class DocsPageGroup {
  readonly pagesList: DocsPageListPage;

  constructor(dashboard: DashboardPage) {
    this.pagesList = new DocsPageListPage(dashboard);
  }
}
