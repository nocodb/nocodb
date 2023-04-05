import { Global, Injectable } from '@nestjs/common'

import * as knex from "knex";

@Global()

@Injectable()
export class Connection {
  private readonly knex: knex.Knex;

  constructor() {
    this.knex = knex.default({
      client: "mysql2",
      connection: {
        host: "localhost",
        user: "root",
        password: "password",
        database: "sakila"
      }
    });
  }

  get knexInstance(): knex.Knex {
    return this.knex;
  }
}
