import { CellPageObject } from '.';
import BasePage from '../../../Base';

export class GeoDataCellPageObject extends BasePage {
  readonly cell: CellPageObject;

  constructor(cell: CellPageObject) {
    super(cell.rootPage);
    this.cell = cell;
  }

  get({ index, columnHeader }: { index?: number; columnHeader: string }) {
    return this.cell.get({ index, columnHeader });
  }

  async openSetLocation({ index, columnHeader }: { index: number; columnHeader: string }) {
    await this.cell.get({ index, columnHeader }).locator(`[data-testid="nc-geo-data-set-location-button"]`).click();
  }

  async openLatLngSet({ index, columnHeader }: { index: number; columnHeader: string }) {
    await this.cell.get({ index, columnHeader }).locator(`[data-testid="nc-geo-data-lat-long-set"]`).click();
  }

  async enterLatLong({ lat, long }: { lat: string; long: string }) {
    await this.rootPage.locator(`[data-testid="nc-geo-data-latitude"]`).fill(lat);
    await this.rootPage.locator(`[data-testid="nc-geo-data-longitude"]`).fill(long);
  }

  async clickSave() {
    await this.rootPage.locator(`[data-testid="nc-geo-data-save"]`).click();
  }

  async close() {
    await this.rootPage.keyboard.press('Escape');
  }
}
