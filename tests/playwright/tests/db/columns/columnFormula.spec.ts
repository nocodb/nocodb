import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { NcContext, unsetup } from '../../../setup';
import { enableQuickRun, isMysql, isPg, isSqlite } from '../../../setup/db';

// Add formula to be verified here & store expected results for 5 rows
// Column data from City table (Sakila DB)
/**
 * City                   LastUpdate              Addresses                Country
 * A Corua (La Corua)     2006-02-15 04:45:25     939 Probolinggo Loop        Spain
 * Abha                   2006-02-15 04:45:25     733 Mandaluyong Place       Saudi Arabia
 * Abu Dhabi              2006-02-15 04:45:25     535 Ahmadnagar Manor        United Arab Emirates
 * Acua                   2006-02-15 04:45:25     1789 Saint-Denis Parkway    Mexico
 * Adana                  2006-02-15 04:45:25     663 Baha Blanca Parkway     Turkey
 */
const formulaDataByDbType = (context: NcContext, index: number) => {
  if (index === 0)
    return [
      {
        formula: '1 + 1',
        result: ['2', '2', '2', '2', '2'],
        unSupDbType: [],
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
        formula: `DATETIME_DIFF("2022/10/14", "2022/10/15")`,
        result: ['-86400', '-86400', '-86400', '-86400', '-86400'],
      },
      {
        formula: `DATETIME_DIFF("2022/10/14", "2022/10/15", "minutes")`,
        result: ['-1440', '-1440', '-1440', '-1440', '-1440'],
      },
      {
        formula: `DATETIME_DIFF("2023/10/14", "2023/01/13", "minutes")`,
        result: ['394560', '394560', '394560', '394560', '394560'],
      },
      {
        formula: `DATETIME_DIFF("2022/10/14", "2022/10/15", "seconds")`,
        result: ['-86400', '-86400', '-86400', '-86400', '-86400'],
      },
      {
        formula: `DATETIME_DIFF("2022/10/14", "2022/10/15", "milliseconds")`,
        result: ['-86400000', '-86400000', '-86400000', '-86400000', '-86400000'],
      },
      {
        formula: `DATETIME_DIFF("2022/10/14", "2022/10/15", "hours")`,
        result: ['-24', '-24', '-24', '-24', '-24'],
      },
      {
        formula: `DATETIME_DIFF("2022/10/14", "2023/10/14", "w")`,
        result: ['-52', '-52', '-52', '-52', '-52'],
      },
      {
        formula: `DATETIME_DIFF("2022/10/14", "2023/10/14", "M")`,
        result: ['-12', '-12', '-12', '-12', '-12'],
      },
      {
        formula: `DATETIME_DIFF("2022/10/14", "2023/10/14", "Q")`,
        result: ['-4', '-4', '-4', '-4', '-4'],
      },
      {
        formula: `DATETIME_DIFF("2022/10/14", "2023/10/14", "y")`,
        result: ['-1', '-1', '-1', '-1', '-1'],
      },
      {
        formula: `DATETIME_DIFF("2023/01/12", "2023/10/14", "y")`,
        result: ['0', '0', '0', '0', '0'],
      },

      {
        formula: 'IF({CityId} == 1, "TRUE", BLANK())',
        result: ['TRUE', '', '', '', ''],
      },
      {
        formula: 'EVEN({CityId})',
        result: ['2', '2', '4', '4', '6'],
      },
      {
        formula: 'ODD({CityId})',
        result: ['1', '3', '3', '5', '5'],
      },
      {
        formula: 'VALUE("12ab-c345")',
        result: ['-12345', '-12345', '-12345', '-12345', '-12345'],
        unSupDbType: ['sqlite3'],
      },
      {
        formula: 'TRUE()',
        result: ['1', '1', '1', '1', '1'],
      },
      {
        formula: 'FALSE()',
        result: ['0', '0', '0', '0', '0'],
      },
      {
        formula: '"City Name: " & {City}',
        result: [
          'City Name: A Corua (La Corua)',
          'City Name: Abha',
          'City Name: Abu Dhabi',
          'City Name: Acua',
          'City Name: Adana',
        ],
      },

      {
        formula: 'ROUNDDOWN({CityId} + 2.49, 1)',
        result: ['3.4', '4.4', '5.4', '6.4', '7.4'],
        unSupDbType: ['sqlite3'],
      },
      {
        formula: 'ROUNDUP({CityId} + 2.49, 1)',
        result: ['3.5', '4.5', '5.5', '6.5', '7.5'],
        unSupDbType: ['sqlite3'],
      },
      {
        formula: 'RECORD_ID()',
        result: ['1', '2', '3', '4', '5'],
      },
      {
        formula: 'REGEX_MATCH({City}, "a[a-z]a")',
        result: ['0', '0', '0', '0', '1'],
        unSupDbType: ['sqlite3'],
      },
      {
        formula: 'REGEX_EXTRACT({City}, "a[a-z]a")',
        result: ['', '', '', '', 'ana'],
        unSupDbType: ['sqlite3'],
      },
      {
        formula: 'REGEX_REPLACE({City}, "a[a-z]a","...")',
        result: ['A Corua (La Corua)', 'Abha', 'Abu Dhabi', 'Acua', 'Ad...'],
        unSupDbType: ['sqlite3'],
      },
      {
        formula: 'URLENCODE({City})',
        result: ['A%20Corua%20(La%20Corua)', 'Abha', 'Abu%20Dhabi', 'Acua', 'Adana'],
      },
    ];
  else
    return [
      {
        formula: `DATETIME_DIFF("2023/10/14", "2023/01/12", "y")`,
        result: ['0', '0', '0', '0', '0'],
        unSupDbType: [],
      },
      {
        formula: `DATETIME_DIFF("2023-01-12", "2021-08-29", "y")`,
        result: ['1', '1', '1', '1', '1'],
      },
      {
        formula: `DATETIME_DIFF("2021-01-12", "2026-01-29", "y")`,
        result: ['-5', '-5', '-5', '-5', '-5'],
      },
      {
        formula: `DATETIME_DIFF("1990-01-12", "2046-12-29", "y")`,
        result: ['-56', '-56', '-56', '-56', '-56'],
      },
      {
        formula: `DATETIME_DIFF("2022/10/14", "2023/10/14", "d")`,
        result: ['-365', '-365', '-365', '-365', '-365'],
      },
      {
        formula: `DATETIME_DIFF("2022/10/14", "2023/01/12", "d")`,
        result: ['-90', '-90', '-90', '-90', '-90'],
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
        unSupDbType: ['sqlite3'],
      },
      {
        formula: `NOW()`,
        result: ['1', '1', '1', '1', '1'],
      },
      {
        formula: `OR(true, false)`,
        result: isPg(context) ? ['true', 'true', 'true', 'true', 'true'] : ['1', '1', '1', '1', '1'],
      },
      {
        formula: `AND(false, false)`,
        result: isPg(context) ? ['false', 'false', 'false', 'false', 'false'] : ['0', '0', '0', '0', '0'],
      },
      {
        formula: `IF((SEARCH({City}, "Ad") != 0), "2.0","WRONG")`,
        result: ['WRONG', 'WRONG', 'WRONG', 'WRONG', '2.0'],
      },

      // additional tests for formula case-insensitivity
      {
        formula: `weekday("2022-07-19")`,
        result: ['1', '1', '1', '1', '1'],
      },
      {
        formula: `Weekday("2022-07-19")`,
        result: ['1', '1', '1', '1', '1'],
      },
      {
        formula: `WeekDay("2022-07-19")`,
        result: ['1', '1', '1', '1', '1'],
      },
    ];
};

test.describe('Virtual Columns', () => {
  if (enableQuickRun()) test.skip();

  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
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

  async function formulaTestSpec(index: number) {
    // close 'Team & Auth' tab
    const formulaData = formulaDataByDbType(context, index);
    const dbType = context.base.sources[0].type;

    await dashboard.treeView.openTable({ title: 'City' });
    // Create dummy formula column which will then be updated for every testcase
    await dashboard.grid.column.create({
      title: 'NC_MATH_0',
      type: 'Formula',
      formula: '1 + 1',
    });

    // verify different formula's
    for (let i = 0; i < formulaData.length; i++) {
      await dashboard.grid.column.openEdit({
        title: 'NC_MATH_0',
        type: 'Formula',
        formula: formulaData[i].formula,
      });
      console.log(`running test function: ${formulaData[i].formula}`);
      if (formulaData[i].unSupDbType?.includes(dbType)) {
        // assert for message not supported or greyed out save button.
        await dashboard.grid.column.checkMessageAndClose({ errorMessage: new RegExp('Function .* is not available') });
        continue;
      }
      await dashboard.grid.column.save({ isUpdated: true });
      if (formulaData[i].formula !== `NOW()`) {
        await formulaResultVerify({
          title: 'NC_MATH_0',
          result: formulaData[i].result,
        });
      }
    }
  }

  test('Formula - suite 0', async () => {
    await formulaTestSpec(0);
  });
  test('Formula - suite 1', async () => {
    await formulaTestSpec(1);
  });
});
