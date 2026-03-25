import { expect } from 'chai';
import { UITypes } from 'nocodb-sdk';
import { beforeEach as dataApiV3BeforeEach } from './beforeEach';
import {
  createLtarColumn2,
  customColumns,
} from '../../../factory/column';
import { createBulkRows } from '../../../factory/row';
import { createTable } from '../../../factory/table';
import { ncAxios } from './ncAxios';
import { getColumnId, idc, prepareRecords } from './helpers';
import type { ITestContext } from './helpers';
import type { ColumnType } from 'nocodb-sdk';
import type { Model } from '../../../../../src/models';
import type { INcAxios } from './ncAxios';

const API_VERSION = 'v3';

describe('dataApiV3', () => {
  describe('ltar-v2', () => {
    let testContext: ITestContext;
    let testAxios: INcAxios;
    let urlPrefix: string;
    let ncAxiosGet: INcAxios['ncAxiosGet'];
    let ncAxiosPost: INcAxios['ncAxiosPost'];
    let ncAxiosPatch: INcAxios['ncAxiosPatch'];
    let ncAxiosLinkAdd: INcAxios['ncAxiosLinkAdd'];
    let ncAxiosLinkRemove: INcAxios['ncAxiosLinkRemove'];

    let tblCity: Model;
    let tblCountry: Model;
    let tblActor: Model;
    let tblFilm: Model;

    let columnsFilm: ColumnType[];
    let columnsActor: ColumnType[];
    let columnsCountry: ColumnType[];
    let columnsCity: ColumnType[];

    beforeEach(async () => {
      testContext = await dataApiV3BeforeEach();
      testAxios = ncAxios(testContext);
      urlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;

      ncAxiosGet = testAxios.ncAxiosGet;
      ncAxiosPost = testAxios.ncAxiosPost;
      ncAxiosPatch = testAxios.ncAxiosPatch;
      ncAxiosLinkAdd = testAxios.ncAxiosLinkAdd;
      ncAxiosLinkRemove = testAxios.ncAxiosLinkRemove;

      const columns = [
        {
          title: 'Title',
          column_name: 'Title',
          uidt: UITypes.SingleLineText,
          pv: true,
        },
      ];

      // Prepare City table
      columns[0].title = 'City';
      columns[0].column_name = 'City';
      tblCity = await createTable(testContext.context, testContext.base, {
        title: 'City',
        table_name: 'City',
        columns: customColumns('custom', columns),
      });
      await createBulkRows(testContext.context, {
        base: testContext.base,
        table: tblCity,
        values: prepareRecords('City', 100, 1, { ignoreId: true }),
      });

      // Prepare Country table
      columns[0].title = 'Country';
      columns[0].column_name = 'Country';
      tblCountry = await createTable(testContext.context, testContext.base, {
        title: 'Country',
        table_name: 'Country',
        columns: customColumns('custom', columns),
      });
      await createBulkRows(testContext.context, {
        base: testContext.base,
        table: tblCountry,
        values: prepareRecords('Country', 100, 1, { ignoreId: true }),
      });

      // Prepare Actor table
      columns[0].title = 'Actor';
      columns[0].column_name = 'Actor';
      tblActor = await createTable(testContext.context, testContext.base, {
        title: 'Actor',
        table_name: 'Actor',
        columns: customColumns('custom', columns),
      });
      await createBulkRows(testContext.context, {
        base: testContext.base,
        table: tblActor,
        values: prepareRecords('Actor', 100, 1, { ignoreId: true }),
      });

      // Prepare Film table
      columns[0].title = 'Film';
      columns[0].column_name = 'Film';
      tblFilm = await createTable(testContext.context, testContext.base, {
        title: 'Film',
        table_name: 'Film',
        columns: customColumns('custom', columns),
      });
      await createBulkRows(testContext.context, {
        base: testContext.base,
        table: tblFilm,
        values: prepareRecords('Film', 100, 1, { ignoreId: true }),
      });

      // Create V2 links using new relation types
      // Country <om> City (One-to-Many — V2 equivalent of HM)
      await createLtarColumn2(testContext.context, {
        title: 'Cities',
        parentTable: tblCountry,
        childTable: tblCity,
        type: 'om',
      });
      // Actor <mm> Film (Many-to-Many)
      await createLtarColumn2(testContext.context, {
        title: 'Films',
        parentTable: tblActor,
        childTable: tblFilm,
        type: 'mm',
      });

      columnsFilm = await tblFilm.getColumns(testContext.ctx);
      columnsActor = await tblActor.getColumns(testContext.ctx);
      columnsCountry = await tblCountry.getColumns(testContext.ctx);
      columnsCity = await tblCity.getColumns(testContext.ctx);

      // Setup OM links: Country 1 -> Cities 1-5
      await ncAxiosLinkAdd({
        urlParams: {
          tableId: tblCountry.id,
          linkId: getColumnId(columnsCountry, 'Cities'),
          rowId: '1',
        },
        body: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
      });

      // Setup MM links: Actor 1 -> Films 1-5
      await ncAxiosLinkAdd({
        urlParams: {
          tableId: tblActor.id,
          linkId: getColumnId(columnsActor, 'Films'),
          rowId: '1',
        },
        body: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
      });
    });

    const expectedCities = [
      { id: 1, id_fields: { Id: 1 }, fields: { City: 'City 1' } },
      { id: 2, id_fields: { Id: 2 }, fields: { City: 'City 2' } },
      { id: 3, id_fields: { Id: 3 }, fields: { City: 'City 3' } },
      { id: 4, id_fields: { Id: 4 }, fields: { City: 'City 4' } },
      { id: 5, id_fields: { Id: 5 }, fields: { City: 'City 5' } },
    ];

    const expectedFilms = [
      { id: 1, id_fields: { Id: 1 }, fields: { Film: 'Film 1' } },
      { id: 2, id_fields: { Id: 2 }, fields: { Film: 'Film 2' } },
      { id: 3, id_fields: { Id: 3 }, fields: { Film: 'Film 3' } },
      { id: 4, id_fields: { Id: 4 }, fields: { Film: 'Film 4' } },
      { id: 5, id_fields: { Id: 5 }, fields: { Film: 'Film 5' } },
    ];

    // ─── column metadata ──────────────────────────────────────

    describe('column metadata', () => {
      it('OM column has uidt=LinkToAnotherRecord and version=2', async function () {
        const citiesCol = columnsCountry.find((c) => c.title === 'Cities');
        expect(citiesCol).to.not.be.undefined;
        expect(citiesCol!.uidt).to.equal(UITypes.LinkToAnotherRecord);
        expect((citiesCol as any).colOptions?.version).to.equal(2);
      });

      it('MO (inverse of OM) column has uidt=LinkToAnotherRecord and version=2', async function () {
        const countryCol = columnsCity.find((c) => c.title === 'Country');
        expect(countryCol).to.not.be.undefined;
        expect(countryCol!.uidt).to.equal(UITypes.LinkToAnotherRecord);
        expect((countryCol as any).colOptions?.version).to.equal(2);
      });

      it('MM column has uidt=LinkToAnotherRecord and version=2', async function () {
        const filmsCol = columnsActor.find((c) => c.title === 'Films');
        expect(filmsCol).to.not.be.undefined;
        expect(filmsCol!.uidt).to.equal(UITypes.LinkToAnotherRecord);
        expect((filmsCol as any).colOptions?.version).to.equal(2);
      });
    });

    // ─── dataList ──────────────────────────────────────────────

    describe('dataList', () => {
      it('OM: returns nested records by default', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          query: { where: '(Id,eq,1)' },
        });

        expect(rsp.body.records.length).to.equal(1);
        const cities = rsp.body.records[0].fields['Cities'];
        expect(cities).to.be.an('array');
        expect(cities).to.have.length(5);
        expect(cities.sort(idc)).to.deep.equal(expectedCities);
      });

      it('MM: returns nested records by default', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblActor.id}/records`,
          query: { where: '(Id,eq,1)' },
        });

        expect(rsp.body.records.length).to.equal(1);
        const films = rsp.body.records[0].fields['Films'];
        expect(films).to.be.an('array');
        expect(films).to.have.length(5);
        expect(films.sort(idc)).to.deep.equal(expectedFilms);
      });

      it('MO: returns nested object', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCity.id}/records`,
          query: { where: '(Id,eq,1)' },
        });

        const expectedCountry = { id: 1, id_fields: { Id: 1 }, fields: { Country: 'Country 1' } };
        expect(rsp.body.records[0].fields['Country']).to.deep.equal(
          expectedCountry,
        );
      });

      it('OM: record with no links returns empty array', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          query: { where: '(Id,eq,2)' },
        });

        expect(rsp.body.records.length).to.equal(1);
        const cities = rsp.body.records[0].fields['Cities'];
        expect(cities).to.be.an('array');
        expect(cities).to.have.length(0);
      });

      it('OM: multiple records - mixed linked and unlinked', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          query: { where: '(Id,le,2)' },
        });

        expect(rsp.body.records.length).to.equal(2);

        const record1 = rsp.body.records.find((r) => r.id === 1);
        const record2 = rsp.body.records.find((r) => r.id === 2);

        expect(record1.fields['Cities']).to.be.an('array');
        expect(record1.fields['Cities']).to.have.length(5);

        expect(record2.fields['Cities']).to.be.an('array');
        expect(record2.fields['Cities']).to.have.length(0);
      });

      it('MO: unlinked record returns null', async function () {
        // City 6 is not linked to any country
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCity.id}/records`,
          query: { where: '(Id,eq,6)' },
        });

        expect(rsp.body.records.length).to.equal(1);
        const country = rsp.body.records[0].fields['Country'];
        expect(country).to.be.null;
      });

      it('fields filter includes only requested link fields', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          query: {
            where: '(Id,eq,1)',
            fields: 'Country',
          },
        });

        expect(rsp.body.records.length).to.equal(1);
        expect(rsp.body.records[0].fields).to.have.property('Country');
        expect(rsp.body.records[0].fields).to.not.have.property('Cities');
      });

      it('fields filter requesting link field returns nested data', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          query: {
            where: '(Id,eq,1)',
            fields: 'Cities',
          },
        });

        expect(rsp.body.records.length).to.equal(1);
        const cities = rsp.body.records[0].fields['Cities'];
        expect(cities).to.be.an('array');
        expect(cities).to.have.length(5);
      });
    });

    // ─── dataRead ──────────────────────────────────────────────

    describe('dataRead', () => {
      it('OM: returns nested records by default', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records/1`,
        });

        const cities = rsp.body.fields['Cities'];
        expect(cities).to.be.an('array');
        expect(cities).to.have.length(5);
        expect(cities.sort(idc)).to.deep.equal(expectedCities);
      });

      it('MM: returns nested records by default', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblActor.id}/records/1`,
        });

        const films = rsp.body.fields['Films'];
        expect(films).to.be.an('array');
        expect(films).to.have.length(5);
        expect(films.sort(idc)).to.deep.equal(expectedFilms);
      });

      it('MO: returns nested object', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCity.id}/records/1`,
        });

        const country = rsp.body.fields['Country'];
        expect(country).to.deep.equal({
          id: 1,
          id_fields: { Id: 1 },
          fields: { Country: 'Country 1' },
        });
      });

      it('OM: unlinked record returns empty array', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records/2`,
        });

        const cities = rsp.body.fields['Cities'];
        expect(cities).to.be.an('array');
        expect(cities).to.have.length(0);
      });

      it('MO: unlinked record returns null', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCity.id}/records/6`,
        });

        const country = rsp.body.fields['Country'];
        expect(country).to.be.null;
      });
    });

    // ─── dataInsert ────────────────────────────────────────────

    describe('dataInsert', () => {
      it('OM: insert with inline link returns nested records', async function () {
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          body: [
            { fields: { Country: 'InlineCountry', Cities: [{ id: 8 }] } },
          ],
        });

        expect(rsp.body.records).to.have.length(1);
        const record = rsp.body.records[0];
        const cities = record.fields['Cities'];
        expect(cities).to.be.an('array');
        expect(cities).to.have.length(1);
        expect(cities[0]).to.deep.equal({ id: 8, id_fields: { Id: 8 }, fields: { City: 'City 8' } });
      });

      it('MO: insert with inline link returns nested object', async function () {
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${tblCity.id}/records`,
          body: [
            {
              fields: {
                City: 'InlineCity',
                Country: { id: 2 },
              },
            },
          ],
        });

        expect(rsp.body.records).to.have.length(1);
        const record = rsp.body.records[0];
        const country = record.fields['Country'];
        expect(country).to.deep.equal({
          id: 2,
          id_fields: { Id: 2 },
          fields: { Country: 'Country 2' },
        });
      });

      it('bulk insert returns nested records', async function () {
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          body: [
            { fields: { Country: 'Bulk1' } },
            { fields: { Country: 'Bulk2' } },
            { fields: { Country: 'Bulk3' } },
          ],
        });

        expect(rsp.body.records).to.have.length(3);
        for (const record of rsp.body.records) {
          expect(record.fields['Cities']).to.be.an('array');
          expect(record.fields['Cities']).to.have.length(0);
        }
      });

      it('OM: insert and then link, verify nested records', async function () {
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          body: { fields: { Country: 'TestCountry' } },
        });

        expect(rsp.body.records).to.have.length(1);
        const newId = rsp.body.records[0].id;

        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: `${newId}`,
          },
          body: [{ id: 6 }, { id: 7 }],
        });

        const readRsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records/${newId}`,
        });

        const cities = readRsp.body.fields['Cities'];
        expect(cities).to.be.an('array');
        expect(cities).to.have.length(2);
        expect(cities.sort(idc)).to.deep.equal([
          { id: 6, id_fields: { Id: 6 }, fields: { City: 'City 6' } },
          { id: 7, id_fields: { Id: 7 }, fields: { City: 'City 7' } },
        ]);
      });
    });

    // ─── dataUpdate ────────────────────────────────────────────

    describe('dataUpdate', () => {
      it('OM: response contains nested records', async function () {
        const rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          body: [{ id: 1, fields: { Country: 'UpdatedCountry' } }],
        });

        expect(rsp.body.records).to.have.length(1);
        const record = rsp.body.records[0];
        const cities = record.fields['Cities'];
        expect(cities).to.be.an('array');
        expect(cities).to.have.length(5);
        expect(cities.sort(idc)).to.deep.equal(expectedCities);
      });

      it('MO: response contains nested object after update', async function () {
        const rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${tblCity.id}/records`,
          body: [{ id: 1, fields: { City: 'UpdatedCity' } }],
        });

        expect(rsp.body.records).to.have.length(1);
        const record = rsp.body.records[0];
        const country = record.fields['Country'];
        expect(country).to.deep.equal({
          id: 1,
          id_fields: { Id: 1 },
          fields: { Country: 'Country 1' },
        });
      });

      it('OM: bulk update with nested records', async function () {
        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '2',
          },
          body: [{ id: 6 }],
        });

        const rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          body: [
            { id: 1, fields: { Country: 'BulkUpdated1' } },
            { id: 2, fields: { Country: 'BulkUpdated2' } },
          ],
        });

        expect(rsp.body.records).to.have.length(2);

        const rec1 = rsp.body.records.find((r) => r.id === 1);
        const rec2 = rsp.body.records.find((r) => r.id === 2);

        expect(rec1.fields['Cities']).to.be.an('array');
        expect(rec1.fields['Cities']).to.have.length(5);

        expect(rec2.fields['Cities']).to.be.an('array');
        expect(rec2.fields['Cities']).to.have.length(1);
        expect(rec2.fields['Cities'][0]).to.deep.equal({
          id: 6,
          id_fields: { Id: 6 },
          fields: { City: 'City 6' },
        });
      });
    });

    // ─── Link add/remove ──────────────────────────────────────

    describe('after link changes', () => {
      it('OM: removing links reflects in response', async function () {
        await ncAxiosLinkRemove({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
          body: [1, 3, 5],
        });

        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records/1`,
        });

        const cities = rsp.body.fields['Cities'];
        expect(cities).to.be.an('array');
        expect(cities).to.have.length(2);
        expect(cities.sort(idc)).to.deep.equal([
          { id: 2, id_fields: { Id: 2 }, fields: { City: 'City 2' } },
          { id: 4, id_fields: { Id: 4 }, fields: { City: 'City 4' } },
        ]);
      });

      it('OM: removing all links returns empty array', async function () {
        await ncAxiosLinkRemove({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
          body: [1, 2, 3, 4, 5],
        });

        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records/1`,
        });

        const cities = rsp.body.fields['Cities'];
        expect(cities).to.be.an('array');
        expect(cities).to.have.length(0);
      });

      it('MO: removing link from child reflects in response', async function () {
        // City 1 is linked to Country 1 — remove it via the MO column
        await ncAxiosLinkRemove({
          urlParams: {
            tableId: tblCity.id,
            linkId: getColumnId(columnsCity, 'Country'),
            rowId: '1',
          },
          body: [1],
        });

        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCity.id}/records/1`,
        });

        const country = rsp.body.fields['Country'];
        expect(country).to.be.null;
      });

      it('MM: adding more links reflects in response', async function () {
        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblActor.id,
            linkId: getColumnId(columnsActor, 'Films'),
            rowId: '1',
          },
          body: [{ id: 6 }, { id: 7 }],
        });

        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblActor.id}/records/1`,
        });

        const films = rsp.body.fields['Films'];
        expect(films).to.be.an('array');
        expect(films).to.have.length(7);
      });

      it('MM: removing links reflects in response', async function () {
        await ncAxiosLinkRemove({
          urlParams: {
            tableId: tblActor.id,
            linkId: getColumnId(columnsActor, 'Films'),
            rowId: '1',
          },
          body: [1, 2, 3],
        });

        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblActor.id}/records/1`,
        });

        const films = rsp.body.fields['Films'];
        expect(films).to.be.an('array');
        expect(films).to.have.length(2);
        expect(films.sort(idc)).to.deep.equal([
          { id: 4, id_fields: { Id: 4 }, fields: { Film: 'Film 4' } },
          { id: 5, id_fields: { Id: 5 }, fields: { Film: 'Film 5' } },
        ]);
      });
    });
  });
});
