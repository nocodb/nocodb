import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';
import { GridPage } from '../pages/Dashboard/Grid';

type ExpectedQrCodeData = {
  referencedValue: string;
  base64EncodedSrc: string;
};

test.describe('Virtual Columns', () => {
  let dashboard: DashboardPage;
  let grid: GridPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
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
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAACWCAYAAAA8AXHiAAAAAXNSR0IArs4c6QAAB1FJREFUeF7tndF2GjEMRMP/f3R6IG1ZNms08kjeQG6fZUseXcuyCeXy+fn5+cE/FChW4AJYxYoy3U0BwAKEFgUAq0VWJgUsGGhRALBaZGVSwIKBFgUAq0VWJgUsGGhRALBaZGVSwIKBFgUAq0VWJgUsGGhRALBaZGVSwIKBFgUAq0VWJgUsGGhRALBaZGVSwIKBFgUAq0VWJgUsGGhRoAWsy+XSEuzspO73RZz1jHw7c87q8Gycq9F+bsASsuRAAFiCwKqJkwjVR8bO3Y3OegArk6nA1klEYRj/pwKsWFVXI47CWONvFs5GoWJNCD4acpSI6h1R4VsF5ih2d43ueCddK3wva94B6xGFFcmt2HyzAAOWoBwVSxBpZwJYgmaAJYgEWHcF6LHuWlS3KlQsYTNSsQSRflrFUqvG0dLOTLjbfKvjq/W56qj6zuO0OQ06/n+sTODVwmV8Hwmnjlft3JtZtT6AJWwXKtZzkTKPs2/XY1XvyDMrSSY5apzV+lCxqFg3BQBrA4K6GzuEy/hWeyyB8ZsJFYvmfchKR4VQAVZ7Rhd0d/Mp/k9/x6pOpCtadTzcChUMRZtMcqsTmfGtVhJx2RyF23aId6xHbKpBp2Kp21Kwy1SN6kR2+Fabctc3PVYAlyuwwO7wFtbhG7DUjHArTL0RARZgpT5gVY9hwAIswNow8Ks/K8zvhecjMj3Wmb5fJc5ZjU5/IJ0N3L3GV/u9zpeBJWNbHesK34BVmLVMwjK2hSEOLy1qH6nGAliqUoJdBpaMreA6ZbLCN2ClUlLX361I7pntwjKwCvOXnsq9HakQqHajfiy9sMIBL3sUFmqQngqwYskAK9bomwVgxaIBVqwRYBVqNDHV181z1Z/NzAZYMY6KFav4EhUrXsbPtVA/P1RXUJ0w1e/Zdi0V6+xFOf4By1HvPhawdjoCFmDVKABYPTp2NO8tkS6alIpVIzRHIRWrhqS9jh0Vy/1oQ/1SgWPnqplZo+PL8TOqvituqi0VKyOGaltt5yT79gB48LMuHQlz/ADWLstOJXISkYHtFfwAFmANmXYABizAAizluMhc2dW+ZNXOdfwo2vyzUTWqbgtGMap5UNe4rHl3F+QkPHMkOH5U0UfN/9F4wNqoou7G6xB1pzgJB6wYeTUP8UxfFlQs4YG0WnQqloqnkByOwkcF1KrOUVh4FKrHnpqcyf3xdJiT8Ew8q9ZYXZV/5FEIWHf0AIuK1fIxD2ABFmBtGVj11w2Z5p2jkKMw04fKtg5YmSZU9SMHnjBUfat2R64z73eJ0CXTluZd8vzESBVTtRu5csc761R9q3aAJWRDFVO1A6xHBTJVXUjXoQkVayfLCtGvLtVNodpRsYQtoIqp2lGx3rhiue8x6kv3EUTuV+yFvXAzyYDu6LGqqqrrPqyWHc8NmbKsBg9Yd6UAa0ONs0Ov0wAWYB3fEg6+1aJWK8Ba3yNlcsNRuFMg0xMpQmfmcyo4R6GSjRNtnOSql4TM67caj9MWjKp/dRp+5DtW9SIzzw2O70zCM7b7mJyxgOVkWByrVghxutQFw4HDGQtYajYNO8AyxAuGchQWapupJBlbjsLCJK2YiorVp3JLxapOmLv8zPXcid2pQu4a3fEZjRRfgCW8bSlCjppiB1TVb4UdYE2omBHNAYGKdU8OFYuKdVMgs/mUvQ1YgPXaYFXviNGuyXxep+y8jJ/MfM6x6Wq5QqNlFcsVQ03aCtGusTi9mNvou1qu0AiwVGILj0zAKhTd3WVqKCt2IxUrzgYVK9bo0IKj8Llwp4PlJEhtgN0vU6gxqvGMUqKOV6u/GvdLPzdkkqsWETcR6rGpJkiNB7DUDAuNLWDFYqpgUrE2WgIWYMUKBBbqEePertwdrsbJUZhH4lc370dyqbDlpX4cofrpgFo9Sp01ApbRH1rCi78eBlgbldXdePZRSMVytgbvWKk/CclsCictqh8qFhUrxRlgpeT6MlZFO/soVOOsthtJ6lSnTJrU9WTm3Nv+6uZdFbjaDrAmkVUTQcWKnyCOUuA+F2TyM4nAul//ereXd/dxVr2RAtYLNu/qzq224yicrINqIianfzrM9e2OV9e0ws/oMuAepcoaT2/elSAzNm7C3PFqrCv8AJaaDcHOTZg7Xggx/SSjzvntyj/47zmpWBOKumC449WQV/ihYqnZEOzchLnjhRCpWKpISgleUX5H72IZ34A1m/Xdm1zHDwioH03ULCGeJfOG5rxPZaCs1kiNe6RWZvPFin+seyBVgumyAaxYWcCKNfpmAVixaIAVawRYfxXIHLeABViHCvyKHmsi9wx5MwVaPtJ5M41YzoQCgDUhGkNiBQAr1giLCQUAa0I0hsQKAFasERYTCgDWhGgMiRUArFgjLCYUAKwJ0RgSKwBYsUZYTCgAWBOiMSRWALBijbCYUACwJkRjSKwAYMUaYTGhAGBNiMaQWAHAijXCYkIBwJoQjSGxAoAVa4TFhAKANSEaQ2IFACvWCIsJBf4ABVN/xpCpplAAAAAASUVORK5CYII=',
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
