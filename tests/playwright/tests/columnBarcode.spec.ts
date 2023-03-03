import { expect, test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';
import { GridPage } from '../pages/Dashboard/Grid';

interface ExpectedBarcodeData {
  referencedValue: string;
  barcodeImg: string;
}

test.describe('Virtual Columns', () => {
  let dashboard: DashboardPage;
  let grid: GridPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    grid = dashboard.grid;
  });

  test.describe('Barcode Column', () => {
    const initiallyExpectedBarcodeCellValues: ExpectedBarcodeData[] = [
      {
        referencedValue: 'A Corua (La Corua)',
        barcodeImg: "iVBORw0KGgoAAAANSUhEUgAAAE0AAAAYCAYAAAC/SnD0AAADmklEQVRYhe3YP0h6axzH8c/PLAvzD1KaRDo0NEZrDlZbUZyx0SEKwsFAamkoiKYIoUFawiHMoiEzaAjCkNKowCjqiGF6iBBP/kclrMP3TjfiLr/u4cavC+e1neF8eZ734TzD84uICJLfIiIIgoB6vQ7Zn17M/1HD4uLiYiKRQDKZRLlcRltbGyKRCNRqNaLRKARBQDgchtFoRCaTQSqVAsdxqFQqEAQBgiAgEAggnU6jVCrBYDDA5/PBZDLh4uICHMchHo+jVCqhpaUFPM+jXq8jEAhAqVRCqVTi8fERp6en4HkeZrMZALC9vY2bmxuoVCpUq1UIgoB0Oo1QKIRarYbGxkbUajWwLIt4PA6NRoOGhgbs7Owgk8mgvb0dyWQSR0dH0Ov1OD8/R61WQywWQ2dnJ8LhMEwmE0KhEPR6Pa6vryGXyxEIBFCv16HT6XB4eIiOjg74/X4QEV5eXqDT6QAioo2NDXI4HORyuYiIyGazEcuyZLPZyOv1Um9vLyWTSdrb26P5+XmanJwkl8tFwWCQWJYlpVJJVquVZmdn6f39nQDQ3d0dMQxDDMOQxWIhp9NJt7e3tLu7S2dnZySTycjj8VChUCC3201ms5kYhqG/NTU1EQDyer10cHBA0WiUPB4Pmc1mcjqdFIlEKBKJ0MzMDA0PD1M0GqVCoUAAyGq10sPDA7lcLgJAwWCQBgYGaGlpiRiGoUqlQuPj40RExDAMpdNpstvtdHJyQgDI4XAQz/PU3d1NLMuSQqGghYUFWl5epmq1StLvKYIUTQQpmghSNBGkaCJI0USQookgRRNBiiaCFE0EKZoIUjQRpGgiSNFE+CXd3H7Nt9/cplIp7O/vfzzzPA+fz/fl9+/v78GyLLa2tvDPb1oqlbC5ufnbGbFY7OsL/pfk3zG0Wq2iVquhWCxCo9Fgenoaq6urmJqaQk9PD/r7+5HP55FOp9Hc3Ay5XI6uri5YLBYAwMrKCtxuN4xGI46Pj5HNZjEyMgK1Wo2xsTGsr69jbm4Ocrkco6OjyGazkMlk4DgOBoMBra2tHze0KpXqP9/ft0TL5XIYHBxEsViEVqvF2toarq6uYLfb8fr6Co7jMDQ0hEQigVgsBoVCgefn54/3M5kMnp6ecHl5Ca1Wi3K5jLe3NwCA3+9HKBTCxMQE8vk8stks+vr6wHEccrncxwye59HU1PQd2/uZZ1q5XIZarf7jMz77fKb9yGg/0edofwGCHxKE5AgAYwAAAABJRU5ErkJggg=="
      },
      {
        referencedValue: 'Abha',
        barcodeImg: "iVBORw0KGgoAAAANSUhEUgAAAB0AAAAYCAYAAAAGXva8AAABS0lEQVRIie3Wsc7pAADF8T/BSmKViMlCDAYSa81GsRnMDH0MjyDSxUNIOhlNldjRNFhECaFN2p7vFe7w3e9+yXVe4Jecs5yUJPHDSf80CJABiOOYzWZDKpWiXq/jeR6n04kkSWi322QyGfb7PcViEdu2aTablEol0uk0l8uF9XqNYRisViuSJKHT6QCw2+0IgoAwDCkUCtRqNXK5HEhSEAQaj8cyTVOPx0OWZanf76vX6+l2uymKIs3nc223W+XzeVmWJd/39Xq9ZNu2yuWyXNdVo9FQtVqV4zhyHEeTyUSDwUDdblemacr3fUnSP6n3g37QD/pBP+h/gqZ+9XOIoojFYsH1euV4PBLHMYfD4e+iklgul7iuy2w24/l8Mp1O8TyP0WjE+/3+fvR8PjMcDrnf71QqFbLZLK1WizAMMQyD1+v1x+jv3vQ78wWboLxxDKRNAAAAAABJRU5ErkJggg=="
      },
    ];

    const barcodeCellValuesForBerlin = {
      referencedValue: 'Berlin',
      barcodeImg: "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"
    };

    const barcodeCellValuesForBerlinAfterCityChange = {
      referencedValue: 'Berlin',
      barcodeImg: "iVBORw0KGgoAAAANSUhEUgAAACUAAAAYCAYAAAB9ejRwAAABy0lEQVRIie3Wv+tpYRzA8TfH/XLkdL5RZkUZdAbEQmE2m8z+AHa6/4BNmfgLDAaySiI2MZKBDESI8qNzzh1u99Z3udf31u1r8Jqenp7h3fM8w8dwvd50nowJ4O3t21d3/Ha73X9GAcxmM7bbLU6nE5fLxWg04nK5YLVacTqdzOdzfD4fkiQxHo/xer3UajVisRiyLCOKIqqqstlsMJlM9Ho9PB4PiqKw3+/Z7XYAOBwOJpMJqqri9/tptVq43W4sFgs+nw8AIZ/PfxcEgXq9TqPRwGg0oigKpVKJbrfLcrlEkiSq1SqBQAC73U65XCYYDBIOh0kkEthsNqxWK5fLheFwyOFwIJPJIIoi8Xic6XRKv99nsVggyzLFYpFOp0MkEiGZTCIIAqvVimg0iqpqGL/mkf7sFfWoV9SjXlGPekU96hX1qFfUo54yynC93vRnG/I+fVO6rlOpVFiv1x/2T6cThUIBgGazia7/+5Rt+vuRjwwGA+/v7+RyOYLBILIsYzabCYVCdDod7vc77Xab4/GIpmmk0+n/H6XrOufzmWw2y2KxwGazsV6vkSSJVCrFYDDA6/VisVhwOBxomobR+LkHeco/Zfq1eCY/AHx5rVCCJeMLAAAAAElFTkSuQmCC"
    };

    const barcodeCellValuesForBerlinAfterRename = {
      referencedValue: 'Berlin',
      barcodeImg: "iVBORw0KGgoAAAANSUhEUgAAACUAAAAYCAYAAAB9ejRwAAABsUlEQVRIie3WT8spURzA8a8/hWmmEWWtKAvNArGhPNbWVtZeAC9A3oCdsuIVWFiQrSYRO7Eki5EFEaKUxjyru3jq1p3b7d6rp/msTqez+J5+Z3FshmEYvBn7/w74GeePxXq95ng8EggECAaDzOdzHo8HgiAQCATYbDZEo1EkSWKxWBCJROh0OmSzWWRZxuPxoOs6h8MBp9PJeDwmHA6jKArn85nT6QSA3+9nuVyi6zqxWIzBYEAoFMLtdhONRgFw1Gq1GkC326XX62G321EUhUajwWg0YrvdIkkS7XabeDyOz+ej2WySSCRIpVLkcjlEUUQQBB6PB7PZjMvlQqlUwuPx8PHxwWq1YjKZoGkasixTr9dRVZV0Ok0+n8fhcLDb7chkMsCbjs+KMsuKMsuKMsuKMsuKMsuKMusto2zf4udpGAatVov9fv9l/3a7Ua1WAej3+/zJXZ2/PvKVzWbD6/VSqVRIJBLIsozL5SKZTKKqKs/nk+FwyPV65fV6USwW/36UYRjc73fK5TKapiGKIvv9HkmSKBQKTKdTIpEIbrcbv9/P6/XCbv+9gXyPN/UvfAJB056YP3pVZwAAAABJRU5ErkJggg=="
    };

    const barcodeCellValuesForIstanbul = {
      referencedValue: 'Istanbul',
      barcodeImg: "iVBORw0KGgoAAAANSUhEUgAAACoAAAAYCAYAAACMcW/9AAAAAXNSR0IArs4c6QAAAgdJREFUWIXtlj1rIgEQht+cItoZjagsEpGUlmLrHxD8AfkBWmmrEPGqpLTTStIFOwsbRUFENMUSFy2SYrUQNCiCFqvrR3Tfa44011xECAafboaBeYaZYi5IEifAr+8W+F90yWTyd7fbxWg0gs1mgyzLsFgsUFUV0+kUq9UKlUoFDocDsixjvV6jVqtBURQIgoB8Pg+v14tqtQqPx4OnpycYjUZomoblconJZIJ6vY7lcglRFGG32yGKIkwmE3a7HdrtNl5fX2GxWDAcDvH+/o7BYIBerwdFUXB5eQmdTges12smEgnGYjEqisJ0Os3tdsvBYMBischarUZBEChJEpPJJPP5PJ1OJ8PhMEnSYDCQJAOBAP+eETOZDJvNJhuNBh8fH+lyuRiLxXh9fU1JkhgKhdhoNPj29sbb21v6/X6+vLwwm80ylUoxEokwGAwylUpxPp+TJE9m9WfRY3MWPTZn0WNzFj02Z9FjcxY9NicjevFjP3xN01AoFPD8/PyZK5VK/9TN53MsFovPuNfrYTweH6gJgAcwHo+52Wx4f3/PcrnMQCDA2WzGeDzO/X7PaDTKfr/PXC7HVqvFh4cHqqpKWZYPaUeS1H91ME3TIIoirq6uYLVa4Xa7cXd3B1VVcXNzg8ViAZ/Ph4+PD2iaBrPZDEEQ0Ol0MBqN4Ha7odd/ue0PvtHv4g/SLpgapGX5vQAAAABJRU5ErkJggg=="
    };

    const barcodeCode39SvgForBerlin = "iVBORw0KGgoAAAANSUhEUgAAAC0AAAAYCAYAAABurXSEAAACAElEQVRYhe3XMUvrUBiA4ddGNHGwhRJoHeJosbR0ScnQ5SyS0j/Q0Z/h6uZPiJtjQSods7kUCopTIZSmFCK1ERw0QVBbY+9wuc73kkukkHc6w4HvgfMtZ+PjY7FizdqUpAySJP2046+LoojNP4cwDJnNZkynU/L5PIqisLW1xXA45OjoCN/38TyPXC6HoiiEYYgQguFwyGKx4O3tjWw2i+u6CCGYzWbM53P29vbQNA3HcZAkiff3d3Z3dykWi1xfX1MulwFwXRdd1wnDEN/3EULgOA6u6yJJErVajf39fYDf6OVyied59Ho9Li4uMAyDQqFALpfj9PSUwWCAbdt0Oh1qtRqFQoHRaIQQgm63y8vLC4+Pj5RKJSzLwrZter0etm1jmibtdpvz83NkWf6+Z5omx8fHnJycAGBZFpZlMRqNsG2bRqNBt9vFsixkWebs7OwbnUn+geOXopMqRSdVik6qFJ1UKTqpUnRSrSV64/Pzc7WWn4A4BUHA5eUluq5zc3NDpVJhMplgGAbz+ZxqtcrV1RW6rnN/f0+9XkdV1VgzY69HNptlPB7z/PzMw8MDqqpyd3eHqqooisLr6yuHh4esViv6/T7b29txR8ZHB0HAwcEBOzs7aJrG09MTrVaL29tbHMchCAJc1yWTydBsNv8Lej13Ooq+iKKvn7b8U78AEoLYoGIKzDUAAAAASUVORK5CYII="



    async function barcodeColumnVerify(barcodeColumnTitle: string, expectedBarcodeCodeData: ExpectedBarcodeData[]) {
      for (let i = 0; i < expectedBarcodeCodeData.length; i++) {
        await grid.cell.verifyBarcodeCell({
          index: i,
          columnHeader: barcodeColumnTitle,
          expectedImgValue: expectedBarcodeCodeData[i].barcodeImg,
        });
      }
    }
    test('creation, showing, updating value and change barcode column title and reference column', async () => {
      // Add barcode code column referencing the City column
      // and compare the base64 encoded codes/src attributes for the first 3 rows.
      // Column data from City table (Sakila DB)
      /**
       * City                   LastUpdate              Address List                Country
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

      await barcodeColumnVerify('Barcode1', [barcodeCellValuesForBerlinAfterCityChange]);

      await grid.cell.get({ columnHeader: 'Barcode1', index: 0 }).click();
      const barcodeGridOverlay = grid.barcodeOverlay;
      await barcodeGridOverlay.verifyBarcodeImgValue(barcodeCellValuesForBerlin.barcodeImg);
      await barcodeGridOverlay.clickCloseButton();

      // Change the barcode column title
      await grid.column.openEdit({ title: 'Barcode1' });
      await grid.column.fillTitle({ title: 'Barcode1 Renamed' });
      await grid.column.save({ isUpdated: true });
      await barcodeColumnVerify('Barcode1 Renamed', [barcodeCellValuesForBerlinAfterRename]);

      // Change the referenced column title
      await grid.column.openEdit({ title: 'City' });
      await grid.column.fillTitle({ title: 'City Renamed' });
      await grid.column.save({ isUpdated: true });
      await barcodeColumnVerify('Barcode1 Renamed', [barcodeCellValuesForBerlinAfterRename]);

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

      await barcodeColumnVerify('Barcode1', [{ referencedValue: 'Berlin', barcodeImg: barcodeCode39SvgForBerlin }]);
    });
  });
});
