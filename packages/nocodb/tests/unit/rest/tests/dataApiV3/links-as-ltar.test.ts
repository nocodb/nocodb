import { expect } from 'chai';
import {
  beforeEachLinkBased,
  beforeEach as dataApiV3BeforeEach,
} from './beforeEach';
import { ncAxios } from './ncAxios';
import { getColumnId, idc } from './helpers';
import type { ITestContext } from './helpers';
import type { ColumnType } from 'nocodb-sdk';
import type { Model } from '../../../../../src/models';
import type { INcAxios } from './ncAxios';

const API_VERSION = 'v3';

describe('dataApiV3', () => {
  describe('links-as-ltar', () => {
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

      const initResult = await beforeEachLinkBased(testContext);
      tblCity = initResult.tblCity;
      tblCountry = initResult.tblCountry;
      tblActor = initResult.tblActor;
      tblFilm = initResult.tblFilm;
      columnsFilm = initResult.columnsFilm;
      columnsActor = initResult.columnsActor;
      columnsCountry = initResult.columnsCountry;
      columnsCity = initResult.columnsCity;

      // Setup HM links: Country 1 -> Cities 1-5
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
      { id: 1, fields: { City: 'City 1' } },
      { id: 2, fields: { City: 'City 2' } },
      { id: 3, fields: { City: 'City 3' } },
      { id: 4, fields: { City: 'City 4' } },
      { id: 5, fields: { City: 'City 5' } },
    ];

    const expectedFilms = [
      { id: 1, fields: { Film: 'Film 1' } },
      { id: 2, fields: { Film: 'Film 2' } },
      { id: 3, fields: { Film: 'Film 3' } },
      { id: 4, fields: { Film: 'Film 4' } },
      { id: 5, fields: { Film: 'Film 5' } },
    ];

    // ─── dataList ──────────────────────────────────────────────

    describe('dataList', () => {
      it('HM: returns count without linksAsLtar', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          query: { where: '(Id,eq,1)' },
        });

        expect(rsp.body.records.length).to.equal(1);
        expect(rsp.body.records[0].fields['Cities']).to.equal(5);
      });

      it('HM: returns nested records with linksAsLtar=true', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          query: { where: '(Id,eq,1)', linksAsLtar: 'true' },
        });

        expect(rsp.body.records.length).to.equal(1);
        const cities = rsp.body.records[0].fields['Cities'];
        expect(cities).to.be.an('array');
        expect(cities).to.have.length(5);
        expect(cities.sort(idc)).to.deep.equal(expectedCities);
      });

      it('MM: returns nested records with linksAsLtar=true', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblActor.id}/records`,
          query: { where: '(Id,eq,1)', linksAsLtar: 'true' },
        });

        expect(rsp.body.records.length).to.equal(1);
        const films = rsp.body.records[0].fields['Films'];
        expect(films).to.be.an('array');
        expect(films).to.have.length(5);
        expect(films.sort(idc)).to.deep.equal(expectedFilms);
      });

      it('BT: always returns nested object regardless of linksAsLtar', async function () {
        const rspWithout = await ncAxiosGet({
          url: `${urlPrefix}/${tblCity.id}/records`,
          query: { where: '(Id,eq,1)' },
        });

        const rspWith = await ncAxiosGet({
          url: `${urlPrefix}/${tblCity.id}/records`,
          query: { where: '(Id,eq,1)', linksAsLtar: 'true' },
        });

        const expectedCountry = { id: 1, fields: { Country: 'Country 1' } };

        expect(rspWithout.body.records[0].fields['Country']).to.deep.equal(
          expectedCountry,
        );
        expect(rspWith.body.records[0].fields['Country']).to.deep.equal(
          expectedCountry,
        );
      });

      it('HM: record with no links returns empty array', async function () {
        // Country 2 has no links
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          query: { where: '(Id,eq,2)', linksAsLtar: 'true' },
        });

        expect(rsp.body.records.length).to.equal(1);
        const cities = rsp.body.records[0].fields['Cities'];
        expect(cities).to.be.an('array');
        expect(cities).to.have.length(0);
      });

      it('HM: multiple records - mixed linked and unlinked', async function () {
        // Country 1 has 5 links, Country 2 has 0
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          query: { where: '(Id,le,2)', linksAsLtar: 'true' },
        });

        expect(rsp.body.records.length).to.equal(2);

        const record1 = rsp.body.records.find((r) => r.id === 1);
        const record2 = rsp.body.records.find((r) => r.id === 2);

        expect(record1.fields['Cities']).to.be.an('array');
        expect(record1.fields['Cities']).to.have.length(5);

        expect(record2.fields['Cities']).to.be.an('array');
        expect(record2.fields['Cities']).to.have.length(0);
      });

      it('linksAsLtar=false still returns count', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          query: { where: '(Id,eq,1)', linksAsLtar: 'false' },
        });

        expect(rsp.body.records.length).to.equal(1);
        // 'false' is not 'true', so should return count
        expect(rsp.body.records[0].fields['Cities']).to.equal(5);
      });

      it('linksAsLtar with invalid value returns count', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          query: { where: '(Id,eq,1)', linksAsLtar: '1' },
        });

        expect(rsp.body.records.length).to.equal(1);
        expect(rsp.body.records[0].fields['Cities']).to.equal(5);
      });

      it('fields filter with linksAsLtar includes only requested link fields', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          query: {
            where: '(Id,eq,1)',
            linksAsLtar: 'true',
            fields: 'Country',
          },
        });

        expect(rsp.body.records.length).to.equal(1);
        // Only Country field requested, Cities should not be present
        expect(rsp.body.records[0].fields).to.have.property('Country');
        expect(rsp.body.records[0].fields).to.not.have.property('Cities');
      });

      it('fields filter requesting link field returns nested data', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          query: {
            where: '(Id,eq,1)',
            linksAsLtar: 'true',
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
      it('HM: returns nested records with linksAsLtar=true', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records/1`,
          query: { linksAsLtar: 'true' },
        });

        const cities = rsp.body.fields['Cities'];
        expect(cities).to.be.an('array');
        expect(cities).to.have.length(5);
        expect(cities.sort(idc)).to.deep.equal(expectedCities);
      });

      it('HM: returns count without linksAsLtar', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records/1`,
        });

        expect(rsp.body.fields['Cities']).to.equal(5);
      });

      it('MM: returns nested records with linksAsLtar=true', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblActor.id}/records/1`,
          query: { linksAsLtar: 'true' },
        });

        const films = rsp.body.fields['Films'];
        expect(films).to.be.an('array');
        expect(films).to.have.length(5);
        expect(films.sort(idc)).to.deep.equal(expectedFilms);
      });

      it('HM: unlinked record returns empty array', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records/2`,
          query: { linksAsLtar: 'true' },
        });

        const cities = rsp.body.fields['Cities'];
        expect(cities).to.be.an('array');
        expect(cities).to.have.length(0);
      });

      it('linksAsLtar=false returns count', async function () {
        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records/1`,
          query: { linksAsLtar: 'false' },
        });

        expect(rsp.body.fields['Cities']).to.equal(5);
      });
    });

    // ─── dataInsert ────────────────────────────────────────────

    describe('dataInsert', () => {
      it('HM: insert and verify linked data with linksAsLtar', async function () {
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          body: { fields: { Country: 'TestCountry' } },
          query: { linksAsLtar: 'true' },
        });

        expect(rsp.body.records).to.have.length(1);
        const newId = rsp.body.records[0].id;

        // Link cities to the new country
        await ncAxiosLinkAdd({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: `${newId}`,
          },
          body: [{ id: 6 }, { id: 7 }],
        });

        // Verify via dataRead with linksAsLtar
        const readRsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records/${newId}`,
          query: { linksAsLtar: 'true' },
        });

        const cities = readRsp.body.fields['Cities'];
        expect(cities).to.be.an('array');
        expect(cities).to.have.length(2);
        expect(cities.sort(idc)).to.deep.equal([
          { id: 6, fields: { City: 'City 6' } },
          { id: 7, fields: { City: 'City 7' } },
        ]);
      });

      it('HM: insert with inline link and verify linksAsLtar response', async function () {
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          body: [
            { fields: { Country: 'InlineCountry', Cities: [{ id: 8 }] } },
          ],
          query: { linksAsLtar: 'true' },
        });

        expect(rsp.body.records).to.have.length(1);
        const record = rsp.body.records[0];
        const cities = record.fields['Cities'];
        expect(cities).to.be.an('array');
        expect(cities).to.have.length(1);
        expect(cities[0]).to.deep.equal({ id: 8, fields: { City: 'City 8' } });
      });

      it('bulk insert with linksAsLtar', async function () {
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          body: [
            { fields: { Country: 'Bulk1' } },
            { fields: { Country: 'Bulk2' } },
            { fields: { Country: 'Bulk3' } },
          ],
          query: { linksAsLtar: 'true' },
        });

        expect(rsp.body.records).to.have.length(3);
        // All newly inserted records should have empty Cities arrays
        for (const record of rsp.body.records) {
          expect(record.fields['Cities']).to.be.an('array');
          expect(record.fields['Cities']).to.have.length(0);
        }
      });

      it('insert without linksAsLtar returns count', async function () {
        const rsp = await ncAxiosPost({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          body: { fields: { Country: 'NoLtar' } },
        });

        expect(rsp.body.records).to.have.length(1);
        expect(rsp.body.records[0].fields['Cities']).to.equal(0);
      });
    });

    // ─── dataUpdate ────────────────────────────────────────────

    describe('dataUpdate', () => {
      it('HM: response contains nested records with linksAsLtar=true', async function () {
        const rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          body: [{ id: 1, fields: { Country: 'UpdatedCountry' } }],
          query: { linksAsLtar: 'true' },
        });

        expect(rsp.body.records).to.have.length(1);
        const record = rsp.body.records[0];
        const cities = record.fields['Cities'];
        expect(cities).to.be.an('array');
        expect(cities).to.have.length(5);
        expect(cities.sort(idc)).to.deep.equal(expectedCities);
      });

      it('HM: response contains count without linksAsLtar', async function () {
        const rsp = await ncAxiosPatch({
          url: `${urlPrefix}/${tblCountry.id}/records`,
          body: [{ id: 1, fields: { Country: 'UpdatedCountry2' } }],
        });

        expect(rsp.body.records).to.have.length(1);
        expect(rsp.body.records[0].fields['Cities']).to.equal(5);
      });

      it('bulk update with linksAsLtar', async function () {
        // Link City 6 to Country 2
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
          query: { linksAsLtar: 'true' },
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
          fields: { City: 'City 6' },
        });
      });
    });

    // ─── Link removal ──────────────────────────────────────────

    describe('after link changes', () => {
      it('HM: removing links reflects in linksAsLtar response', async function () {
        // Remove 3 links from Country 1
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
          query: { linksAsLtar: 'true' },
        });

        const cities = rsp.body.fields['Cities'];
        expect(cities).to.be.an('array');
        expect(cities).to.have.length(2);
        expect(cities.sort(idc)).to.deep.equal([
          { id: 2, fields: { City: 'City 2' } },
          { id: 4, fields: { City: 'City 4' } },
        ]);
      });

      it('HM: removing all links returns empty array', async function () {
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
          query: { linksAsLtar: 'true' },
        });

        const cities = rsp.body.fields['Cities'];
        expect(cities).to.be.an('array');
        expect(cities).to.have.length(0);
      });

      it('MM: adding more links reflects in linksAsLtar response', async function () {
        // Add more films to Actor 1
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
          query: { linksAsLtar: 'true' },
        });

        const films = rsp.body.fields['Films'];
        expect(films).to.be.an('array');
        expect(films).to.have.length(7);
      });

      it('HM: count is correct without linksAsLtar after removal', async function () {
        await ncAxiosLinkRemove({
          urlParams: {
            tableId: tblCountry.id,
            linkId: getColumnId(columnsCountry, 'Cities'),
            rowId: '1',
          },
          body: [1, 2],
        });

        const rsp = await ncAxiosGet({
          url: `${urlPrefix}/${tblCountry.id}/records/1`,
        });

        // Should show count of 3 (5 - 2 removed)
        expect(rsp.body.fields['Cities']).to.equal(3);
      });
    });
  });
});
