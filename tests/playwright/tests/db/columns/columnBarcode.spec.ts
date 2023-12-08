import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { GridPage } from '../../../pages/Dashboard/Grid';

interface ExpectedBarcodeData {
  referencedValue: string;
  barcodeSvg: string;
}

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

  test.describe('Barcode Column', () => {
    const initiallyExpectedBarcodeCellValues: ExpectedBarcodeData[] = [
      {
        referencedValue: 'A Corua (La Corua)',
        barcodeSvg:
          '<rect x="0" y="0" width="486" height="142" style="fill:#ffffff;"></rect><g transform="translate(10, 10)" style="fill:#000000;"><rect x="0" y="0" width="4" height="100"></rect><rect x="6" y="0" width="2" height="100"></rect><rect x="12" y="0" width="2" height="100"></rect><rect x="22" y="0" width="2" height="100"></rect><rect x="26" y="0" width="2" height="100"></rect><rect x="34" y="0" width="4" height="100"></rect><rect x="44" y="0" width="4" height="100"></rect><rect x="50" y="0" width="4" height="100"></rect><rect x="58" y="0" width="4" height="100"></rect><rect x="66" y="0" width="2" height="100"></rect><rect x="74" y="0" width="2" height="100"></rect><rect x="82" y="0" width="4" height="100"></rect><rect x="88" y="0" width="2" height="100"></rect><rect x="96" y="0" width="8" height="100"></rect><rect x="106" y="0" width="2" height="100"></rect><rect x="110" y="0" width="2" height="100"></rect><rect x="116" y="0" width="2" height="100"></rect><rect x="122" y="0" width="8" height="100"></rect><rect x="132" y="0" width="2" height="100"></rect><rect x="138" y="0" width="8" height="100"></rect><rect x="150" y="0" width="2" height="100"></rect><rect x="154" y="0" width="2" height="100"></rect><rect x="160" y="0" width="2" height="100"></rect><rect x="164" y="0" width="4" height="100"></rect><rect x="176" y="0" width="4" height="100"></rect><rect x="182" y="0" width="4" height="100"></rect><rect x="190" y="0" width="4" height="100"></rect><rect x="198" y="0" width="2" height="100"></rect><rect x="206" y="0" width="4" height="100"></rect><rect x="214" y="0" width="2" height="100"></rect><rect x="220" y="0" width="2" height="100"></rect><rect x="228" y="0" width="4" height="100"></rect><rect x="234" y="0" width="6" height="100"></rect><rect x="242" y="0" width="2" height="100"></rect><rect x="248" y="0" width="2" height="100"></rect><rect x="252" y="0" width="4" height="100"></rect><rect x="264" y="0" width="4" height="100"></rect><rect x="270" y="0" width="4" height="100"></rect><rect x="278" y="0" width="4" height="100"></rect><rect x="286" y="0" width="2" height="100"></rect><rect x="294" y="0" width="2" height="100"></rect><rect x="302" y="0" width="4" height="100"></rect><rect x="308" y="0" width="2" height="100"></rect><rect x="316" y="0" width="8" height="100"></rect><rect x="326" y="0" width="2" height="100"></rect><rect x="330" y="0" width="2" height="100"></rect><rect x="336" y="0" width="2" height="100"></rect><rect x="342" y="0" width="8" height="100"></rect><rect x="352" y="0" width="2" height="100"></rect><rect x="358" y="0" width="8" height="100"></rect><rect x="370" y="0" width="2" height="100"></rect><rect x="374" y="0" width="2" height="100"></rect><rect x="380" y="0" width="2" height="100"></rect><rect x="384" y="0" width="4" height="100"></rect><rect x="396" y="0" width="4" height="100"></rect><rect x="404" y="0" width="2" height="100"></rect><rect x="410" y="0" width="2" height="100"></rect><rect x="418" y="0" width="6" height="100"></rect><rect x="428" y="0" width="4" height="100"></rect><rect x="436" y="0" width="2" height="100"></rect><rect x="440" y="0" width="4" height="100"></rect><rect x="450" y="0" width="6" height="100"></rect><rect x="458" y="0" width="2" height="100"></rect><rect x="462" y="0" width="4" height="100"></rect><text style="font: 20px monospace" text-anchor="middle" x="233" y="122">A Corua (La Corua)</text></g>',
      },
      {
        referencedValue: 'Abha',
        barcodeSvg:
          '<rect x="0" y="0" width="178" height="142" style="fill:#ffffff;"></rect><g transform="translate(10, 10)" style="fill:#000000;"><rect x="0" y="0" width="4" height="100"></rect><rect x="6" y="0" width="2" height="100"></rect><rect x="12" y="0" width="2" height="100"></rect><rect x="22" y="0" width="2" height="100"></rect><rect x="26" y="0" width="2" height="100"></rect><rect x="34" y="0" width="4" height="100"></rect><rect x="44" y="0" width="2" height="100"></rect><rect x="50" y="0" width="2" height="100"></rect><rect x="60" y="0" width="4" height="100"></rect><rect x="66" y="0" width="2" height="100"></rect><rect x="72" y="0" width="4" height="100"></rect><rect x="84" y="0" width="2" height="100"></rect><rect x="88" y="0" width="2" height="100"></rect><rect x="94" y="0" width="2" height="100"></rect><rect x="98" y="0" width="4" height="100"></rect><rect x="110" y="0" width="6" height="100"></rect><rect x="118" y="0" width="2" height="100"></rect><rect x="124" y="0" width="4" height="100"></rect><rect x="132" y="0" width="4" height="100"></rect><rect x="142" y="0" width="6" height="100"></rect><rect x="150" y="0" width="2" height="100"></rect><rect x="154" y="0" width="4" height="100"></rect><text style="font: 20px monospace" text-anchor="middle" x="79" y="122">Abha</text></g>',
      },
    ];

    const barcodeCellValuesForBerlin = {
      referencedValue: 'Berlin',
      barcodeSvg:
        '<rect x="0" y="0" width="222" height="142" style="fill:#ffffff;"></rect><g transform="translate(10, 10)" style="fill:#000000;"><rect x="0" y="0" width="4" height="100"></rect><rect x="6" y="0" width="2" height="100"></rect><rect x="12" y="0" width="2" height="100"></rect><rect x="22" y="0" width="2" height="100"></rect><rect x="30" y="0" width="2" height="100"></rect><rect x="34" y="0" width="4" height="100"></rect><rect x="44" y="0" width="2" height="100"></rect><rect x="48" y="0" width="4" height="100"></rect><rect x="56" y="0" width="2" height="100"></rect><rect x="66" y="0" width="2" height="100"></rect><rect x="72" y="0" width="2" height="100"></rect><rect x="78" y="0" width="8" height="100"></rect><rect x="88" y="0" width="4" height="100"></rect><rect x="96" y="0" width="2" height="100"></rect><rect x="100" y="0" width="2" height="100"></rect><rect x="110" y="0" width="2" height="100"></rect><rect x="120" y="0" width="4" height="100"></rect><rect x="126" y="0" width="2" height="100"></rect><rect x="132" y="0" width="4" height="100"></rect><rect x="144" y="0" width="2" height="100"></rect><rect x="148" y="0" width="2" height="100"></rect><rect x="154" y="0" width="4" height="100"></rect><rect x="164" y="0" width="2" height="100"></rect><rect x="170" y="0" width="2" height="100"></rect><rect x="176" y="0" width="4" height="100"></rect><rect x="186" y="0" width="6" height="100"></rect><rect x="194" y="0" width="2" height="100"></rect><rect x="198" y="0" width="4" height="100"></rect><text style="font: 20px monospace" text-anchor="middle" x="101" y="122">Berlin</text></g>',
    };

    const barcodeCellValuesForIstanbul = {
      referencedValue: 'Istanbul',
      barcodeSvg:
        '<rect x="0" y="0" width="266" height="142" style="fill:#ffffff;"></rect><g transform="translate(10, 10)" style="fill:#000000;"><rect x="0" y="0" width="4" height="100"></rect><rect x="6" y="0" width="2" height="100"></rect><rect x="12" y="0" width="2" height="100"></rect><rect x="22" y="0" width="4" height="100"></rect><rect x="32" y="0" width="2" height="100"></rect><rect x="40" y="0" width="2" height="100"></rect><rect x="44" y="0" width="2" height="100"></rect><rect x="48" y="0" width="8" height="100"></rect><rect x="60" y="0" width="2" height="100"></rect><rect x="66" y="0" width="2" height="100"></rect><rect x="72" y="0" width="8" height="100"></rect><rect x="82" y="0" width="2" height="100"></rect><rect x="88" y="0" width="2" height="100"></rect><rect x="94" y="0" width="2" height="100"></rect><rect x="98" y="0" width="4" height="100"></rect><rect x="110" y="0" width="4" height="100"></rect><rect x="122" y="0" width="2" height="100"></rect><rect x="126" y="0" width="2" height="100"></rect><rect x="132" y="0" width="2" height="100"></rect><rect x="138" y="0" width="2" height="100"></rect><rect x="148" y="0" width="4" height="100"></rect><rect x="154" y="0" width="2" height="100"></rect><rect x="160" y="0" width="8" height="100"></rect><rect x="172" y="0" width="2" height="100"></rect><rect x="176" y="0" width="4" height="100"></rect><rect x="184" y="0" width="2" height="100"></rect><rect x="188" y="0" width="2" height="100"></rect><rect x="198" y="0" width="4" height="100"></rect><rect x="204" y="0" width="4" height="100"></rect><rect x="214" y="0" width="4" height="100"></rect><rect x="220" y="0" width="4" height="100"></rect><rect x="230" y="0" width="6" height="100"></rect><rect x="238" y="0" width="2" height="100"></rect><rect x="242" y="0" width="4" height="100"></rect><text style="font: 20px monospace" text-anchor="middle" x="123" y="122">Istanbul</text></g>',
    };

    const barcodeCode39SvgForBerlin =
      '<rect x="0" y="0" width="276" height="142" style="fill:#ffffff;"></rect><g transform="translate(10, 10)" style="fill:#000000;"><rect x="0" y="0" width="2" height="100"></rect><rect x="8" y="0" width="2" height="100"></rect><rect x="12" y="0" width="6" height="100"></rect><rect x="20" y="0" width="6" height="100"></rect><rect x="28" y="0" width="2" height="100"></rect><rect x="32" y="0" width="2" height="100"></rect><rect x="36" y="0" width="6" height="100"></rect><rect x="44" y="0" width="2" height="100"></rect><rect x="52" y="0" width="2" height="100"></rect><rect x="56" y="0" width="6" height="100"></rect><rect x="64" y="0" width="6" height="100"></rect><rect x="72" y="0" width="2" height="100"></rect><rect x="76" y="0" width="6" height="100"></rect><rect x="88" y="0" width="2" height="100"></rect><rect x="92" y="0" width="2" height="100"></rect><rect x="96" y="0" width="6" height="100"></rect><rect x="104" y="0" width="2" height="100"></rect><rect x="108" y="0" width="2" height="100"></rect><rect x="112" y="0" width="6" height="100"></rect><rect x="124" y="0" width="2" height="100"></rect><rect x="128" y="0" width="2" height="100"></rect><rect x="132" y="0" width="6" height="100"></rect><rect x="140" y="0" width="2" height="100"></rect><rect x="144" y="0" width="2" height="100"></rect><rect x="152" y="0" width="6" height="100"></rect><rect x="160" y="0" width="2" height="100"></rect><rect x="164" y="0" width="6" height="100"></rect><rect x="172" y="0" width="2" height="100"></rect><rect x="180" y="0" width="6" height="100"></rect><rect x="188" y="0" width="2" height="100"></rect><rect x="192" y="0" width="2" height="100"></rect><rect x="196" y="0" width="2" height="100"></rect><rect x="200" y="0" width="6" height="100"></rect><rect x="208" y="0" width="2" height="100"></rect><rect x="216" y="0" width="6" height="100"></rect><rect x="224" y="0" width="2" height="100"></rect><rect x="232" y="0" width="2" height="100"></rect><rect x="236" y="0" width="6" height="100"></rect><rect x="244" y="0" width="6" height="100"></rect><rect x="252" y="0" width="2" height="100"></rect><text style="font: 20px monospace" text-anchor="middle" x="128" y="122">BERLIN</text></g>';

    const expectedBarcodeCellValuesAfterCityNameChange = [
      barcodeCellValuesForBerlin,
      ...initiallyExpectedBarcodeCellValues.slice(1),
    ];

    async function barcodeColumnVerify(barcodeColumnTitle: string, expectedBarcodeCodeData: ExpectedBarcodeData[]) {
      for (let i = 0; i < expectedBarcodeCodeData.length; i++) {
        await grid.cell.verifyBarcodeCell({
          index: i,
          columnHeader: barcodeColumnTitle,
          expectedSvgValue: expectedBarcodeCodeData[i].barcodeSvg,
        });
      }
    }
    test('creation, showing, updating value and change barcode column title and reference column', async () => {
      // Add barcode code column referencing the City column
      // and compare the base64 encoded codes/src attributes for the first 3 rows.
      // Column data from City table (Sakila DB)
      /**
       * City                   LastUpdate              Addresses                Country
       * A Corua (La Corua)     2006-02-15 04:45:25     939 Probolinggo Loop        Spain
       * Abha                   2006-02-15 04:45:25     733 Mandaluyong Place       Saudi Arabia
       * Abu Dhabi              2006-02-15 04:45:25     535 Ahmadnagar Manor        United Arab Emirates
       */
      // close 'Team & Auth' tab
      await dashboard.closeTab({ title: 'Team & Auth' });

      await dashboard.treeView.openTable({ title: 'City' });

      await grid.column.create({
        title: 'Barcode1',
        type: 'Barcode',
        barcodeValueColumnTitle: 'City',
      });

      await barcodeColumnVerify('Barcode1', initiallyExpectedBarcodeCellValues);

      await grid.cell.fillText({ columnHeader: 'City', index: 0, text: 'Berlin' });

      await barcodeColumnVerify('Barcode1', expectedBarcodeCellValuesAfterCityNameChange);

      await grid.cell.get({ columnHeader: 'Barcode1', index: 0 }).click();
      const barcodeGridOverlay = grid.barcodeOverlay;
      await barcodeGridOverlay.verifyBarcodeSvgValue(barcodeCellValuesForBerlin.barcodeSvg);
      await barcodeGridOverlay.clickCloseButton();

      // Change the barcode column title
      await grid.column.openEdit({ title: 'Barcode1' });
      await grid.column.fillTitle({ title: 'Barcode1 Renamed' });
      await grid.column.save({ isUpdated: true });
      await barcodeColumnVerify('Barcode1 Renamed', expectedBarcodeCellValuesAfterCityNameChange);

      // Change the referenced column title
      await grid.column.openEdit({ title: 'City' });
      await grid.column.fillTitle({ title: 'City Renamed' });
      await grid.column.save({ isUpdated: true });
      await barcodeColumnVerify('Barcode1 Renamed', expectedBarcodeCellValuesAfterCityNameChange);

      // Change the referenced column
      await grid.column.create({ title: 'New City Column' });
      await grid.cell.fillText({ columnHeader: 'New City Column', index: 0, text: 'Istanbul' });
      await grid.column.openEdit({ title: 'Barcode1 Renamed' });
      await grid.column.changeReferencedColumnForBarcode({ titleOfReferencedColumn: 'New City Column' });

      await barcodeColumnVerify('Barcode1 Renamed', [barcodeCellValuesForIstanbul]);

      await dashboard.closeTab({ title: 'City' });
    });

    test('deletion of the barcode column: a) directly and b) indirectly when the reference value column is deleted', async () => {
      await dashboard.closeTab({ title: 'Team & Auth' });

      await dashboard.treeView.openTable({ title: 'City' });

      await grid.column.create({ title: 'column_name_a' });
      await grid.column.verify({ title: 'column_name_a' });
      await grid.column.create({
        title: 'Barcode2',
        type: 'Barcode',
        barcodeValueColumnTitle: 'column_name_a',
      });
      await grid.column.verify({ title: 'Barcode2', isVisible: true });
      await grid.column.delete({ title: 'Barcode2' });
      await grid.column.verify({ title: 'Barcode2', isVisible: false });

      await grid.column.create({
        title: 'Barcode2',
        type: 'Barcode',
        barcodeValueColumnTitle: 'column_name_a',
      });
      await grid.column.verify({ title: 'Barcode2', isVisible: true });
      await grid.column.delete({ title: 'column_name_a' });
      await grid.column.verify({ title: 'Barcode2', isVisible: false });

      await dashboard.closeTab({ title: 'City' });
    });

    test('a) showing an error message for non-compatible barcode input and b) changing the format of the Barcode is reflected in the change of the actual rendered barcode', async () => {
      await dashboard.closeTab({ title: 'Team & Auth' });

      await dashboard.treeView.openTable({ title: 'City' });

      await grid.column.create({
        title: 'Barcode1',
        type: 'Barcode',
        barcodeValueColumnTitle: 'City',
      });

      await grid.column.openEdit({
        title: 'Barcode1',
      });
      await grid.column.changeBarcodeFormat({ barcodeFormatName: 'CODE39' });

      await grid.cell.verifyBarcodeCellShowsInvalidInputMessage({
        index: 0,
        columnHeader: 'Barcode1',
      });

      await grid.cell.fillText({ columnHeader: 'City', index: 0, text: 'Berlin' });

      await barcodeColumnVerify('Barcode1', [{ referencedValue: 'Berlin', barcodeSvg: barcodeCode39SvgForBerlin }]);
    });
  });
});
