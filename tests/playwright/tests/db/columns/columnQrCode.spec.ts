import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { GridPage } from '../../../pages/Dashboard/Grid';

type ExpectedQrCodeData = {
  referencedValue: string;
  base64EncodedSrc: string;
};

test.describe('Virtual Columns', () => {
  let dashboard: DashboardPage;
  let grid: GridPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    grid = dashboard.grid;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test.describe('QrCode Column', () => {
    async function qrCodeColumnVerify(qrColumnTitle: string, expectedQrCodeData: ExpectedQrCodeData[]) {
      for (let i = 0; i < expectedQrCodeData.length; i++) {
        await grid.cell.verifyQrCodeCell({
          index: i,
          columnHeader: qrColumnTitle,
          expectedSrcValue: expectedQrCodeData[i].base64EncodedSrc,
        });
      }
    }
    test('creation, showing, updating value and change qr column title and reference column', async () => {
      // Add qr code column referencing the City column
      // and compare the base64 encoded codes/src attributes for the first 3 rows.
      // Column data from City table (Sakila DB)
      /**
       * City                   LastUpdate              Addresses                Country
       * A Corua (La Corua)     2006-02-15 04:45:25     939 Probolinggo Loop        Spain
       * Abha                   2006-02-15 04:45:25     733 Mandaluyong Place       Saudi Arabia
       * Abu Dhabi              2006-02-15 04:45:25     535 Ahmadnagar Manor        United Arab Emirates
       */
      const expectedQrCodeCellValues: ExpectedQrCodeData[] = [
        {
          referencedValue: 'A Corua (La Corua)',
          base64EncodedSrc:
            'data:image/png;base64,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',
        },
        {
          referencedValue: 'Abha',
          base64EncodedSrc:
            'data:image/png;base64,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',
        },
        {
          referencedValue: 'Abu Dhabi',
          base64EncodedSrc:
            'data:image/png;base64,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',
        },
      ];

      await dashboard.treeView.openTable({ title: 'City' });

      await grid.column.create({
        title: 'QrCode1',
        type: 'QrCode',
        qrCodeValueColumnTitle: 'City',
      });

      await qrCodeColumnVerify('QrCode1', expectedQrCodeCellValues);

      // Clicking on qr code in first row and expect it shows a
      // popup with an enlarged version of the qr code
      await grid.cell.get({ columnHeader: 'QrCode1', index: 0 }).click();
      const qrGridOverlay = grid.qrCodeOverlay;
      await qrGridOverlay.verifyQrValueLabel(expectedQrCodeCellValues[0].referencedValue);
      await qrGridOverlay.clickCloseButton();

      // Change the value in the referenced column, first row
      // and expect respective QR changes accordingly
      await grid.cell.fillText({ columnHeader: 'City', index: 0, text: 'Hamburg' });
      const expectedQrCodeCellValuesAfterCityNameChange = [
        {
          referencedValue: 'Hamburg',
          base64EncodedSrc:
            'data:image/png;base64,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',
        },
        ...expectedQrCodeCellValues.slice(1),
      ];
      await qrCodeColumnVerify('QrCode1', expectedQrCodeCellValuesAfterCityNameChange);

      // Change the QR Code column title
      await grid.column.openEdit({ title: 'QrCode1' });
      await grid.column.fillTitle({ title: 'QrCode1 Renamed' });
      await grid.column.save({ isUpdated: true });
      await qrCodeColumnVerify('QrCode1 Renamed', expectedQrCodeCellValuesAfterCityNameChange);

      // Change the referenced column title
      await grid.column.openEdit({ title: 'City' });
      await grid.column.fillTitle({ title: 'City Renamed' });
      await grid.column.save({ isUpdated: true });
      await qrCodeColumnVerify('QrCode1 Renamed', expectedQrCodeCellValuesAfterCityNameChange);

      // Change to another referenced column
      await grid.column.create({ title: 'New City Column' });
      await grid.cell.fillText({ columnHeader: 'New City Column', index: 0, text: 'Hamburg' });
      await grid.column.openEdit({ title: 'QrCode1 Renamed' });
      await grid.column.changeReferencedColumnForQrCode({ titleOfReferencedColumn: 'New City Column' });

      await qrCodeColumnVerify('QrCode1 Renamed', [
        {
          referencedValue: 'Hamburg',
          base64EncodedSrc:
            'data:image/png;base64,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',
        },
      ]);
    });

    test('deletion of the QR column: directly and indirectly when the reference value column is deleted', async () => {
      await dashboard.treeView.openTable({ title: 'City' });

      await grid.column.create({ title: 'column_name_a' });
      await grid.column.verify({ title: 'column_name_a' });
      await grid.column.create({
        title: 'QrCode2',
        type: 'QrCode',
        qrCodeValueColumnTitle: 'column_name_a',
      });
      await grid.column.verify({ title: 'QrCode2', isVisible: true });
      await grid.column.delete({ title: 'QrCode2' });
      await grid.column.verify({ title: 'QrCode2', isVisible: false });

      await grid.column.create({
        title: 'QrCode2',
        type: 'QrCode',
        qrCodeValueColumnTitle: 'column_name_a',
      });
      await grid.column.verify({ title: 'QrCode2', isVisible: true });
      await grid.column.delete({ title: 'column_name_a' });
      await grid.column.verify({ title: 'QrCode2', isVisible: false });
    });
  });
});
