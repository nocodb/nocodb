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

      await dashboard.treeView.openTable({ title: 'City', baseTitle: context.base.title });

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
      await dashboard.treeView.openTable({ title: 'City', baseTitle: context.base.title });

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
      // QR code column is error-marked (not cascade-deleted) when the reference column is deleted
      await grid.column.verify({ title: 'QrCode2', isVisible: true });
    });
  });
});
