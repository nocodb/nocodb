import { expect } from 'chai';
import 'mocha';
import knex from '../lib/db/sql-data-mapper/lib/sql/CustomKnex';
import formulaQueryBuilderFromString from '../lib/db/sql-data-mapper/lib/sql/formulaQueryBuilderFromString';

process.env.TEST = 'test';

describe('{Auth, CRUD, HasMany, Belongs} Tests', () => {
  let knexMysqlRef;
  let knexPgRef;
  let knexMssqlRef;
  let knexSqliteRef;

  // Called once before any of the tests in this block begin.
  before(function (done) {
    knexMysqlRef = knex({ client: 'mysql2' });
    knexMssqlRef = knex({ client: 'mssql' });
    knexPgRef = knex({ client: 'pg' });
    knexSqliteRef = knex({ client: 'sqlite3' });
    done();
  });

  after((done) => {
    done();
  });

  describe('Formulas', function () {
    it('Simple formula', function (done) {
      expect(
        formulaQueryBuilderFromString(
          "concat(city, ' _ ',city_id+country_id)",
          'a',
          knexMysqlRef
        ).toQuery()
      ).eq("concat(`city`,' _ ',`city_id` + `country_id`) as a");
      expect(
        formulaQueryBuilderFromString(
          "concat(city, ' _ ',city_id+country_id)",
          'a',
          knexPgRef
        ).toQuery()
      ).eq('concat("city",\' _ \',"city_id" + "country_id") as a');
      expect(
        formulaQueryBuilderFromString(
          "concat(city, ' _ ',city_id+country_id)",
          'a',
          knexMssqlRef
        ).toQuery()
      ).eq("concat([city],' _ ',[city_id] + [country_id]) as a");
      expect(
        formulaQueryBuilderFromString(
          "concat(city, ' _ ',city_id+country_id)",
          'a',
          knexSqliteRef
        ).toQuery()
      ).eq("`city` || ' _ ' || (`city_id` + `country_id`) as a");
      done();
    });
    it('Addition', function (done) {
      expect(
        formulaQueryBuilderFromString(
          'ADD(city_id,country_id,2,3,4,5,4)',
          'a',
          knexMysqlRef
        ).toQuery()
      ).eq('`city_id` + `country_id` + 2 + 3 + 4 + 5 + 4 as a');
      expect(
        formulaQueryBuilderFromString(
          'ADD(city_id,country_id,2,3,4,5,4)',
          'a',
          knexPgRef
        ).toQuery()
      ).eq('"city_id" + "country_id" + 2 + 3 + 4 + 5 + 4 as a');
      expect(
        formulaQueryBuilderFromString(
          'ADD(city_id,country_id,2,3,4,5,4)',
          'a',
          knexMssqlRef
        ).toQuery()
      ).eq('[city_id] + [country_id] + 2 + 3 + 4 + 5 + 4 as a');
      expect(
        formulaQueryBuilderFromString(
          'ADD(city_id,country_id,2,3,4,5,4)',
          'a',
          knexSqliteRef
        ).toQuery()
      ).eq('`city_id` + `country_id` + 2 + 3 + 4 + 5 + 4 as a');
      done();
    });
    it('Average', function (done) {
      expect(
        formulaQueryBuilderFromString(
          'AVG(city_id,country_id,2,3,4,5,4)',
          'a',
          knexMysqlRef
        ).toQuery()
      ).eq('(`city_id` + `country_id` + 2 + 3 + 4 + 5 + 4) / 7 as a');
      expect(
        formulaQueryBuilderFromString(
          'AVG(city_id,country_id,2,3,4,5,4)',
          'a',
          knexPgRef
        ).toQuery()
      ).eq('("city_id" + "country_id" + 2 + 3 + 4 + 5 + 4) / 7 as a');
      expect(
        formulaQueryBuilderFromString(
          'AVG(city_id,country_id,2,3,4,5,4)',
          'a',
          knexMssqlRef
        ).toQuery()
      ).eq('([city_id] + [country_id] + 2 + 3 + 4 + 5 + 4) / 7 as a');
      expect(
        formulaQueryBuilderFromString(
          'AVG(city_id,country_id,2,3,4,5,4)',
          'a',
          knexSqliteRef
        ).toQuery()
      ).eq('(`city_id` + `country_id` + 2 + 3 + 4 + 5 + 4) / 7 as a');
      done();
    });
  });
});
