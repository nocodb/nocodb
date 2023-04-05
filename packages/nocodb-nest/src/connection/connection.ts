import { Injectable } from "@nestjs/common";

import * as knex from "knex";

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
        database: "my_database"
      }
    });
  }

  get knexInstance(): knex.Knex {
    return this.knex;
  }
}
