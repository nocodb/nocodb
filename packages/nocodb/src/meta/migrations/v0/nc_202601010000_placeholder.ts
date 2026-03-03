import type { Knex } from 'knex';

/**
 * nc_202601010000_placeholder
 * this is empty placeholder migration
 * to mark the change from sequential numbering to timestamp
 * the format is nc_YYYYMMDDHHmm_{title}, where:
 * YYYY: 4 digit year, ex: 2026
 * MM: 2 digit month, 01 to 12
 * DD: 2 digit day, 01 to 31
 * HH: 2 digit hour in 24-h format, 00 to 23
 * mm: 2 digit minute, 00 to 59
 * title: short description of the migration purpose
 * */

const up = async (_knex: Knex) => {};

const down = async (_knex: Knex) => {};

export { up, down };
