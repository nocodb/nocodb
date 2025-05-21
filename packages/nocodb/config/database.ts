import { Knex } from "knex";

const databaseConfig: Knex.Config = {
    // client: "pg",
    // connection: {
    //     connectionString: process.env.DB_URL,
    //     host: process.env.DB_HOST || "/run/postgresql",
    //     database: process.env.DB_USER || "cplane_nocodb",
    //     port: Number(process.env.DB_PORT) || 5432,
    //     user: process.env.DB_USER || "postgres",
    //     password: process.env.DB_PASS,
    // },
};

export default databaseConfig;
