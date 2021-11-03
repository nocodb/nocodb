import { expect } from 'chai';
import 'mocha';
import knex from '../lib/dataMapper/lib/sql/CustomKnex';
import formulaQueryBuilderFromString from '../lib/dataMapper/lib/sql/formulaQueryBuilderFromString';

process.env.TEST = 'test';

describe('{Auth, CRUD, HasMany, Belongs} Tests', () => {
  let knexMysqlRef;
  let knexPgRef;
  let knexMssqlRef;
  let knexSqliteRef;

  // Called once before any of the tests in this block begin.
  before(function(done) {
    knexMysqlRef = knex({ client: 'mysql2' });
    knexMssqlRef = knex({ client: 'mssql' });
    knexPgRef = knex({ client: 'pg' });
    knexSqliteRef = knex({ client: 'sqlite3' });
    done();
  });

  after(done => {
    done();
  });

  describe('Formulas', function() {
    it('Simple formula', function(done) {
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
    it('Addition', function(done) {
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
    it('Average', function(done) {
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
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *"concat(city, ' _ ',city_id+country_id)", 'a'
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
