import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup from '../../../setup';
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
    dashboard = new DashboardPage(page, context.project);
    grid = dashboard.grid;
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
       * City                   LastUpdate              Address List                Country
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

      // close 'Team & Auth' tab
      await dashboard.closeTab({ title: 'Team & Auth' });

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

      await dashboard.closeTab({ title: 'City' });
    });

    test('deletion of the QR column: directly and indirectly when the reference value column is deleted', async () => {
      // close 'Team & Auth' tab
      await dashboard.closeTab({ title: 'Team & Auth' });

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

      await dashboard.closeTab({ title: 'City' });
    });
  });
});
