import { ErdBasePage } from '../commonBase/Erd';
import { DataSourcesPage } from './DataSources';

export class SettingsErdPage extends ErdBasePage {
  readonly dataSources: DataSourcesPage;

  constructor(dataSources: DataSourcesPage) {
    super(dataSources.rootPage);
    this.dataSources = dataSources;
  }

  get() {
    return this.dataSources.get();
  }
}
