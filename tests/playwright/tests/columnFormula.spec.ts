import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup, { NcContext } from '../setup';
import { isPg, isSqlite } from '../setup/db';

// Add formula to be verified here & store expected results for 5 rows
// Column data from City table (Sakila DB)
/**
 * City                   LastUpdate              Address List                Country
 * A Corua (La Corua)     2006-02-15 04:45:25     939 Probolinggo Loop        Spain
 * Abha                   2006-02-15 04:45:25     733 Mandaluyong Place       Saudi Arabia
 * Abu Dhabi              2006-02-15 04:45:25     535 Ahmadnagar Manor        United Arab Emirates
 * Acua                   2006-02-15 04:45:25     1789 Saint-Denis Parkway    Mexico
 * Adana                  2006-02-15 04:45:25     663 Baha Blanca Parkway     Turkey
 */
const formulaDataByDbType = (context: NcContext) => [
  {
    formula: '1 + 1',
    result: ['2', '2', '2', '2', '2'],
  },
  {
    formula: 'ADD({CityId}, {CountryId}) + AVG({CityId}, {CountryId}) + LEN({City})',
    result: ['150', '130', '165', '100', '158'],
  },
  {
    formula: `WEEKDAY("2022-07-19")`,
    result: ['1', '1', '1', '1', '1'],
  },
  {
    formula: `WEEKDAY("2022-07-19", "sunday")`,
    result: ['2', '2', '2', '2', '2'],
  },
  {
    formula: `CONCAT(UPPER({City}), LOWER({City}), TRIM('    trimmed    '))`,
    result: [
      'A CORUA (LA CORUA)a corua (la corua)trimmed',
      'ABHAabhatrimmed',
      'ABU DHABIabu dhabitrimmed',
      'ACUAacuatrimmed',
      'ADANAadanatrimmed',
    ],
  },
  {
    formula: `CEILING(1.4) + FLOOR(1.6) + ROUND(2.5) + MOD({CityId}, 3) + MIN({CityId}, {CountryId}) + MAX({CityId}, {CountryId})`,
    result: ['95', '92', '110', '71', '110'],
  },
  {
    formula: `LOG({CityId}) + EXP({CityId}) + POWER({CityId}, 3) + SQRT({CountryId})`,
    result: isPg(context)
      ? ['13.04566088154786', '24.74547123273205', '57.61253379902822', '126.94617671688704', '283.9609869087087']
      : ['13.04566088154786', '25.137588417628013', '58.23402483297667', '127.73041108667896', '284.8714548168068'],
  },
  {
    formula: `NOW()`,
    result: ['1', '1', '1', '1', '1'],
  },
];

test.describe('Virtual Columns', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  });

  async function formulaResultVerify({ title, result }: { title: string; result: string[] }) {
    for (let i = 0; i < result.length; i++) {
      await dashboard.grid.cell.verify({
        index: i,
        columnHeader: title,
        value: result[i],
      });
    }
  }

  test('Formula', async () => {
    // close 'Team & Auth' tab
    const formulaData = formulaDataByDbType(context);
    await dashboard.closeTab({ title: 'Team & Auth' });

    await dashboard.treeView.openTable({ title: 'City' });
    // Create formula column
    await dashboard.grid.column.create({
      title: 'NC_MATH_0',
      type: 'Formula',
      formula: formulaData[1].formula,
    });

    // verify different formula's
    for (let i = 1; i < formulaData.length; i++) {
      // Sqlite does not support log function
      if (isSqlite(context) && formulaData[i].formula.includes('LOG(')) continue;

      await dashboard.grid.column.openEdit({
        title: 'NC_MATH_0',
        type: 'Formula',
        formula: formulaData[i].formula,
      });
      await dashboard.grid.column.save({ isUpdated: true });
      if (formulaData[i].formula !== `NOW()`) {
        await formulaResultVerify({
          title: 'NC_MATH_0',
          result: formulaData[i].result,
        });
      }
    }

    await dashboard.closeTab({ title: 'City' });
  });
});
