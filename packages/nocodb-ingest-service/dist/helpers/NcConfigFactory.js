"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultConnectionOptions = exports.defaultConnectionConfig = void 0;
const fs_1 = require("fs");
const url_1 = require("url");
const util_1 = require("util");
const path = require("path");
const parse_database_url_1 = require("parse-database-url");
const driverClientMapping = {
    mysql: 'mysql2',
    mariadb: 'mysql2',
    postgres: 'pg',
    postgresql: 'pg',
    sqlite: 'sqlite3',
    mssql: 'mssql',
};
const defaultClientPortMapping = {
    mysql: 3306,
    mysql2: 3306,
    postgres: 5432,
    pg: 5432,
    mssql: 1433,
};
const defaultConnectionConfig = {
    dateStrings: true,
};
exports.defaultConnectionConfig = defaultConnectionConfig;
const defaultConnectionOptions = {
    pool: {
        min: 0,
        max: 10,
    },
};
exports.defaultConnectionOptions = defaultConnectionOptions;
const knownQueryParams = [
    {
        parameter: 'database',
        aliases: ['d', 'db'],
    },
    {
        parameter: 'password',
        aliases: ['p'],
    },
    {
        parameter: 'user',
        aliases: ['u'],
    },
    {
        parameter: 'title',
        aliases: ['t'],
    },
    {
        parameter: 'keyFilePath',
        aliases: [],
    },
    {
        parameter: 'certFilePath',
        aliases: [],
    },
    {
        parameter: 'caFilePath',
        aliases: [],
    },
    {
        parameter: 'ssl',
        aliases: [],
    },
    {
        parameter: 'options',
        aliases: ['opt', 'opts'],
    },
];
class NcConfigFactory {
    static async make() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        await this.jdbcToXcUrl();
        const ncConfig = new NcConfigFactory();
        ncConfig.auth = {
            jwt: {
                secret: (_a = process.env.NC_AUTH_JWT_SECRET) !== null && _a !== void 0 ? _a : 'temporary-key',
            },
        };
        ncConfig.port = +((_c = (_b = process === null || process === void 0 ? void 0 : process.env) === null || _b === void 0 ? void 0 : _b.PORT) !== null && _c !== void 0 ? _c : 8080);
        ncConfig.env = '_noco';
        ncConfig.workingEnv = '_noco';
        ncConfig.projectType =
            ((_j = (_h = (_g = (_f = (_e = (_d = ncConfig === null || ncConfig === void 0 ? void 0 : ncConfig.envs) === null || _d === void 0 ? void 0 : _d[ncConfig.workingEnv]) === null || _e === void 0 ? void 0 : _e.db) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.meta) === null || _h === void 0 ? void 0 : _h.api) === null || _j === void 0 ? void 0 : _j.type) || 'rest';
        if ((_m = (_l = (_k = ncConfig.meta) === null || _k === void 0 ? void 0 : _k.db) === null || _l === void 0 ? void 0 : _l.connection) === null || _m === void 0 ? void 0 : _m.filename) {
            ncConfig.meta.db.connection.filename = path.join(this.getToolDir(), ncConfig.meta.db.connection.filename);
        }
        if (process.env.NC_DB) {
            ncConfig.meta.db = await this.metaUrlToDbConfig(process.env.NC_DB);
        }
        else if (process.env.NC_DB_JSON) {
            ncConfig.meta.db = JSON.parse(process.env.NC_DB_JSON);
        }
        else if (process.env.NC_DB_JSON_FILE) {
            const filePath = process.env.NC_DB_JSON_FILE;
            if (!(await (0, util_1.promisify)(fs_1.default.exists)(filePath))) {
                throw new Error(`NC_DB_JSON_FILE not found: ${filePath}`);
            }
            const fileContent = await (0, util_1.promisify)(fs_1.default.readFile)(filePath, {
                encoding: 'utf8',
            });
            ncConfig.meta.db = JSON.parse(fileContent);
        }
        if (process.env.NC_TRY) {
            ncConfig.try = true;
            ncConfig.meta.db = {
                client: 'sqlite3',
                connection: ':memory:',
                pool: {
                    min: 1,
                    max: 1,
                    idleTimeoutMillis: 360000 * 1000,
                },
            };
        }
        if (process.env.NC_PUBLIC_URL) {
            ncConfig.envs['_noco'].publicUrl = process.env.NC_PUBLIC_URL;
            ncConfig.publicUrl = process.env.NC_PUBLIC_URL;
        }
        if (process.env.NC_DASHBOARD_URL) {
            ncConfig.dashboardPath = process.env.NC_DASHBOARD_URL;
        }
        return ncConfig;
    }
    static getToolDir() {
        return process.env.NC_TOOL_DIR || process.cwd();
    }
    static hasDbUrl() {
        return Object.keys(process.env).some((envKey) => envKey.startsWith('NC_DB_URL'));
    }
    static makeFromUrls(urls) {
        const config = new NcConfigFactory();
        config.envs['_noco'].db = [];
        for (const [i, url] of Object.entries(urls)) {
            config.envs['_noco'].db.push(this.urlToDbConfig(url, i));
        }
        return config;
    }
    static urlToDbConfig(urlString, key = '', config, type) {
        const url = new url_1.URL(urlString);
        let dbConfig;
        if (url.protocol.startsWith('sqlite3')) {
            dbConfig = {
                client: 'sqlite3',
                connection: {
                    client: 'sqlite3',
                    connection: {
                        filename: url.searchParams.get('d') || url.searchParams.get('database'),
                    },
                    database: url.searchParams.get('d') || url.searchParams.get('database'),
                },
            };
        }
        else {
            const parsedQuery = {};
            for (const [key, value] of url.searchParams.entries()) {
                const fnd = knownQueryParams.find((param) => param.parameter === key || param.aliases.includes(key));
                if (fnd) {
                    parsedQuery[fnd.parameter] = value;
                }
                else {
                    parsedQuery[key] = value;
                }
            }
            dbConfig = {
                client: url.protocol.replace(':', ''),
                connection: Object.assign(Object.assign(Object.assign({}, defaultConnectionConfig), parsedQuery), { host: url.hostname, port: +url.port }),
                acquireConnectionTimeout: 600000,
            };
            if (process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
                dbConfig.connection.ssl = true;
            }
            if (url.searchParams.get('keyFilePath') &&
                url.searchParams.get('certFilePath') &&
                url.searchParams.get('caFilePath')) {
                dbConfig.connection.ssl = {
                    keyFilePath: url.searchParams.get('keyFilePath'),
                    certFilePath: url.searchParams.get('certFilePath'),
                    caFilePath: url.searchParams.get('caFilePath'),
                };
            }
        }
        if (config && !config.title) {
            config.title =
                url.searchParams.get('t') ||
                    url.searchParams.get('title') ||
                    this.generateRandomTitle();
        }
        Object.assign(dbConfig, {
            meta: {
                tn: 'nc_evolutions',
                allSchemas: !!url.searchParams.get('allSchemas') ||
                    !(url.searchParams.get('d') || url.searchParams.get('database')),
                api: {
                    prefix: url.searchParams.get('apiPrefix') || '',
                    swagger: true,
                    type: type ||
                        (url.searchParams.get('api') ||
                            url.searchParams.get('a')) ||
                        'rest',
                },
                dbAlias: url.searchParams.get('dbAlias') || `db${key}`,
                metaTables: 'db',
                migrations: {
                    disabled: false,
                    name: 'nc_evolutions',
                },
            },
        });
        return dbConfig;
    }
    static generateRandomTitle() {
        return '';
    }
    static async metaUrlToDbConfig(urlString) {
        var _a, _b;
        const url = new url_1.URL(urlString);
        let dbConfig;
        if (url.protocol.startsWith('sqlite3')) {
            const db = url.searchParams.get('d') || url.searchParams.get('database');
            dbConfig = Object.assign({ client: 'sqlite3', connection: {
                    filename: db,
                } }, (db === ':memory:'
                ? {
                    pool: {
                        min: 1,
                        max: 1,
                        idleTimeoutMillis: 360000 * 1000,
                    },
                }
                : {}));
        }
        else {
            const parsedQuery = {};
            for (const [key, value] of url.searchParams.entries()) {
                const fnd = knownQueryParams.find((param) => param.parameter === key || param.aliases.includes(key));
                if (fnd) {
                    parsedQuery[fnd.parameter] = value;
                }
                else {
                    parsedQuery[key] = value;
                }
            }
            dbConfig = Object.assign({ client: url.protocol.replace(':', ''), connection: Object.assign(Object.assign(Object.assign({}, defaultConnectionConfig), parsedQuery), { host: url.hostname, port: +url.port }), acquireConnectionTimeout: 600000 }, (url.searchParams.has('search_path')
                ? {
                    searchPath: url.searchParams.get('search_path').split(','),
                }
                : {}));
            if (process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
                dbConfig.connection.ssl = true;
            }
        }
        url.searchParams.forEach((_value, key) => {
            let value = _value;
            if (value === 'true') {
                value = true;
            }
            else if (value === 'false') {
                value = false;
            }
            else if (/^\d+$/.test(value)) {
                value = +value;
            }
            if (![
                'password',
                'p',
                'database',
                'd',
                'user',
                'u',
                'search_path',
            ].includes(key)) {
                key.split('.').reduce((obj, k, i, arr) => {
                    return (obj[k] = i === arr.length - 1 ? value : obj[k] || {});
                }, dbConfig);
            }
        });
        if (((_a = dbConfig === null || dbConfig === void 0 ? void 0 : dbConfig.connection) === null || _a === void 0 ? void 0 : _a.ssl) &&
            typeof ((_b = dbConfig === null || dbConfig === void 0 ? void 0 : dbConfig.connection) === null || _b === void 0 ? void 0 : _b.ssl) === 'object') {
            if (dbConfig.connection.ssl.caFilePath && !dbConfig.connection.ssl.ca) {
                dbConfig.connection.ssl.ca = (await (0, util_1.promisify)(fs_1.default.readFile)(dbConfig.connection.ssl.caFilePath)).toString();
                delete dbConfig.connection.ssl.caFilePath;
            }
            if (dbConfig.connection.ssl.keyFilePath && !dbConfig.connection.ssl.key) {
                dbConfig.connection.ssl.key = (await (0, util_1.promisify)(fs_1.default.readFile)(dbConfig.connection.ssl.keyFilePath)).toString();
                delete dbConfig.connection.ssl.keyFilePath;
            }
            if (dbConfig.connection.ssl.certFilePath &&
                !dbConfig.connection.ssl.cert) {
                dbConfig.connection.ssl.cert = (await (0, util_1.promisify)(fs_1.default.readFile)(dbConfig.connection.ssl.certFilePath)).toString();
                delete dbConfig.connection.ssl.certFilePath;
            }
        }
        return dbConfig;
    }
    static async makeProjectConfigFromUrl(url, type) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const config = new NcConfigFactory();
        const dbConfig = this.urlToDbConfig(url, '', config, type);
        config.envs['_noco'].db.push(dbConfig);
        if (process.env.NC_AUTH_ADMIN_SECRET) {
            config.auth = {
                masterKey: {
                    secret: (_a = process.env.NC_AUTH_ADMIN_SECRET) !== null && _a !== void 0 ? _a : 'temporary-key',
                },
            };
        }
        else if (process.env.NC_NO_AUTH) {
            config.auth = {
                disabled: true,
            };
        }
        else if ((_d = (_c = (_b = config === null || config === void 0 ? void 0 : config.envs) === null || _b === void 0 ? void 0 : _b['_noco']) === null || _c === void 0 ? void 0 : _c.db) === null || _d === void 0 ? void 0 : _d[0]) {
            config.auth = {
                jwt: {
                    dbAlias: process.env.NC_AUTH_JWT_DB_ALIAS ||
                        config.envs['_noco'].db[0].meta.dbAlias,
                    secret: (_e = process.env.NC_AUTH_JWT_SECRET) !== null && _e !== void 0 ? _e : 'temporary-key',
                },
            };
        }
        if (process.env.NC_DB) {
            config.meta.db = await this.metaUrlToDbConfig(process.env.NC_DB);
        }
        if (process.env.NC_TRY) {
            config.try = true;
            config.meta.db = {
                client: 'sqlite3',
                connection: ':memory:',
                pool: {
                    min: 1,
                    max: 1,
                    idleTimeoutMillis: 360000 * 1000,
                },
            };
        }
        if (process.env.NC_MAILER) {
            config.mailer = {
                from: process.env.NC_MAILER_FROM,
                options: {
                    host: process.env.NC_MAILER_HOST,
                    port: parseInt(process.env.NC_MAILER_PORT, 10),
                    secure: process.env.NC_MAILER_SECURE === 'true',
                    auth: {
                        user: process.env.NC_MAILER_USER,
                        pass: process.env.NC_MAILER_PASS,
                    },
                },
            };
        }
        if (process.env.NC_PUBLIC_URL) {
            config.envs['_noco'].publicUrl = process.env.NC_PUBLIC_URL;
            config.publicUrl = process.env.NC_PUBLIC_URL;
        }
        config.port = +((_g = (_f = process === null || process === void 0 ? void 0 : process.env) === null || _f === void 0 ? void 0 : _f.PORT) !== null && _g !== void 0 ? _g : 8080);
        config.env = '_noco';
        config.workingEnv = '_noco';
        config.toolDir = this.getToolDir();
        config.projectType =
            type ||
                ((_o = (_m = (_l = (_k = (_j = (_h = config === null || config === void 0 ? void 0 : config.envs) === null || _h === void 0 ? void 0 : _h[config.workingEnv]) === null || _j === void 0 ? void 0 : _j.db) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.meta) === null || _m === void 0 ? void 0 : _m.api) === null || _o === void 0 ? void 0 : _o.type) ||
                'rest';
        return config;
    }
    static async makeProjectConfigFromConnection(dbConnectionConfig, type) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const config = new NcConfigFactory();
        let dbConfig = dbConnectionConfig;
        if (dbConfig.client === 'sqlite3') {
            dbConfig = {
                client: 'sqlite3',
                connection: Object.assign(Object.assign({}, dbConnectionConfig), { database: dbConnectionConfig.connection.filename }),
            };
        }
        const key = '';
        Object.assign(dbConfig, {
            meta: {
                tn: 'nc_evolutions',
                api: {
                    prefix: '',
                    swagger: true,
                    type: type || 'rest',
                },
                dbAlias: `db${key}`,
                metaTables: 'db',
                migrations: {
                    disabled: false,
                    name: 'nc_evolutions',
                },
            },
        });
        config.envs['_noco'].db.push(dbConfig);
        if (process.env.NC_AUTH_ADMIN_SECRET) {
            config.auth = {
                masterKey: {
                    secret: (_a = process.env.NC_AUTH_ADMIN_SECRET) !== null && _a !== void 0 ? _a : 'temporary-key',
                },
            };
        }
        else if (process.env.NC_NO_AUTH) {
            config.auth = {
                disabled: true,
            };
        }
        else if ((_d = (_c = (_b = config === null || config === void 0 ? void 0 : config.envs) === null || _b === void 0 ? void 0 : _b['_noco']) === null || _c === void 0 ? void 0 : _c.db) === null || _d === void 0 ? void 0 : _d[0]) {
            config.auth = {
                jwt: {
                    dbAlias: process.env.NC_AUTH_JWT_DB_ALIAS ||
                        config.envs['_noco'].db[0].meta.dbAlias,
                    secret: (_e = process.env.NC_AUTH_JWT_SECRET) !== null && _e !== void 0 ? _e : 'temporary-key',
                },
            };
        }
        if (process.env.NC_DB) {
            config.meta.db = await this.metaUrlToDbConfig(process.env.NC_DB);
        }
        if (process.env.NC_TRY) {
            config.try = true;
            config.meta.db = {
                client: 'sqlite3',
                connection: ':memory:',
                pool: {
                    min: 1,
                    max: 1,
                    idleTimeoutMillis: 360000 * 1000,
                },
            };
        }
        if (process.env.NC_PUBLIC_URL) {
            config.envs['_noco'].publicUrl = process.env.NC_PUBLIC_URL;
            config.publicUrl = process.env.NC_PUBLIC_URL;
        }
        config.port = +((_g = (_f = process === null || process === void 0 ? void 0 : process.env) === null || _f === void 0 ? void 0 : _f.PORT) !== null && _g !== void 0 ? _g : 8080);
        config.env = '_noco';
        config.workingEnv = '_noco';
        config.toolDir = process.env.NC_TOOL_DIR || process.cwd();
        config.projectType =
            type ||
                ((_o = (_m = (_l = (_k = (_j = (_h = config === null || config === void 0 ? void 0 : config.envs) === null || _h === void 0 ? void 0 : _h[config.workingEnv]) === null || _j === void 0 ? void 0 : _j.db) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.meta) === null || _m === void 0 ? void 0 : _m.api) === null || _o === void 0 ? void 0 : _o.type) ||
                'rest';
        return config;
    }
    constructor() {
        this.version = '0.6';
        this.queriesFolder = '';
        this.meta = {
            db: {
                client: 'sqlite3',
                connection: {
                    filename: 'noco.db',
                },
            },
        };
        this.try = false;
        this.dashboardPath = '/dashboard';
        this.envs = { _noco: { db: [] } };
    }
    static async jdbcToXcUrl() {
        if (process.env.NC_DATABASE_URL_FILE || process.env.DATABASE_URL_FILE) {
            const database_url = await (0, util_1.promisify)(fs_1.default.readFile)(process.env.NC_DATABASE_URL_FILE || process.env.DATABASE_URL_FILE, 'utf-8');
            process.env.NC_DB = this.extractXcUrlFromJdbc(database_url);
        }
        else if (process.env.NC_DATABASE_URL || process.env.DATABASE_URL) {
            process.env.NC_DB = this.extractXcUrlFromJdbc(process.env.NC_DATABASE_URL || process.env.DATABASE_URL);
        }
    }
    static extractXcUrlFromJdbc(url, rtConfig = false) {
        if (url.startsWith('jdbc:')) {
            url = url.substring(5);
        }
        const config = (0, parse_database_url_1.default)(url);
        const parsedConfig = {};
        for (const [key, value] of Object.entries(config)) {
            const fnd = knownQueryParams.find((param) => param.parameter === key || param.aliases.includes(key));
            if (fnd) {
                parsedConfig[fnd.parameter] = value;
            }
            else {
                parsedConfig[key] = value;
            }
        }
        if (!(parsedConfig === null || parsedConfig === void 0 ? void 0 : parsedConfig.port))
            parsedConfig.port =
                defaultClientPortMapping[driverClientMapping[parsedConfig.driver] || parsedConfig.driver];
        if (rtConfig) {
            const { driver } = parsedConfig, connectionConfig = __rest(parsedConfig, ["driver"]);
            const client = driverClientMapping[driver] || driver;
            const avoidSSL = [
                'localhost',
                '127.0.0.1',
                'host.docker.internal',
                '172.17.0.1',
            ];
            if (client === 'pg' &&
                !(connectionConfig === null || connectionConfig === void 0 ? void 0 : connectionConfig.ssl) &&
                !avoidSSL.includes(connectionConfig.host)) {
                connectionConfig.ssl = 'true';
            }
            return {
                client: client,
                connection: Object.assign({}, connectionConfig),
            };
        }
        const { driver, host, port, database, user, password } = parsedConfig, extra = __rest(parsedConfig, ["driver", "host", "port", "database", "user", "password"]);
        const extraParams = [];
        for (const [key, value] of Object.entries(extra)) {
            extraParams.push(`${key}=${value}`);
        }
        const res = `${driverClientMapping[driver] || driver}://${host}${port ? `:${port}` : ''}?${user ? `u=${user}&` : ''}${password ? `p=${password}&` : ''}${database ? `d=${database}&` : ''}${extraParams.join('&')}`;
        return res;
    }
}
exports.default = NcConfigFactory;
//# sourceMappingURL=NcConfigFactory.js.map