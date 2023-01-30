import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';
import { isPg } from '../setup/db';

test.describe('Relational Columns', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  });

  test('Relational columns: HM, BT, MM', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });

    ///////////// Has many
    //

    const cityList = [['Kabul'], ['Batna', 'Bchar', 'Skikda']];
    await dashboard.treeView.openTable({ title: 'Country' });
    for (let i = 0; i < cityList.length; i++) {
      await dashboard.grid.cell.verifyVirtualCell({
        index: i,
        columnHeader: 'City List',
        count: cityList[i].length,
        value: cityList[i],
      });
    }

    // click on expand icon, open child list
    await dashboard.grid.cell.inCellExpand({
      index: 0,
      columnHeader: 'City List',
    });
    await dashboard.childList.verify({
      cardTitle: ['Kabul'],
      linkField: 'City',
    });

    // open link record modal
    //
    await dashboard.childList.openLinkRecord({ linkTableTitle: 'City' });
    await dashboard.linkRecord.verify([
      'A Corua (La Corua)',
      'Abha',
      'Abu Dhabi',
      'Acua',
      'Adana',
      'Addis Abeba',
      'Aden',
      'Adoni',
      'Ahmadnagar',
      'Akishima',
    ]);
    await dashboard.linkRecord.close();

    ///////////// Belongs to
    //

    await dashboard.treeView.openTable({ title: 'City' });
    const countryList = [['Spain'], ['Saudi Arabia']];
    for (let i = 0; i < countryList.length; i++) {
      await dashboard.grid.cell.verifyVirtualCell({
        index: i,
        columnHeader: 'Country',
        count: countryList[i].length,
        value: countryList[i],
      });
    }

    ///////////// Many to many
    //
    await dashboard.treeView.openTable({ title: 'Actor' });
    const filmList = [
      [
        'ACADEMY DINOSAUR',
        'ANACONDA CONFESSIONS',
        'ANGELS LIFE',
        'BULWORTH COMMANDMENTS',
        'CHEAPER CLYDE',
        'COLOR PHILADELPHIA',
        'ELEPHANT TROJAN',
        'GLEAMING JAWBREAKER',
        'HUMAN GRAFFITI',
        'KING EVOLUTION',
      ],
    ];
    for (let i = 0; i < filmList.length; i++) {
      await dashboard.grid.cell.verifyVirtualCell({
        index: i,
        columnHeader: 'Film List',
        // Count hardwired to avoid verifying all 19 entries
        count: 19,
        value: filmList[i],
      });
    }
    // click on expand icon, open child list
    await dashboard.grid.cell.inCellExpand({
      index: 0,
      columnHeader: 'Film List',
    });
    await dashboard.childList.verify({
      cardTitle: filmList[0],
      linkField: 'Film',
    });

    // open link record modal
    //
    await dashboard.childList.openLinkRecord({ linkTableTitle: 'Film' });
    await dashboard.linkRecord.verify([
      'ACE GOLDFINGER',
      'ADAPTATION HOLES',
      'AFFAIR PREJUDICE',
      'AFRICAN EGG',
      'AGENT TRUMAN',
      'AIRPLANE SIERRA',
      'AIRPORT POLLOCK',
      'ALABAMA DEVIL',
      'ALADDIN CALENDAR',
      'ALAMO VIDEOTAPE',
    ]);
    await dashboard.linkRecord.close();
  });
});
