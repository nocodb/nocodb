"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ClickhouseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClickhouseService = void 0;
const common_1 = require("@nestjs/common");
const clickhouse_1 = require("clickhouse");
const nc_001_notification = require("./migrations/nc_001_notification");
const nc_002_page = require("./migrations/nc_002_page");
const nc_003_api_count = require("./migrations/nc_003_api_count");
const nc_004_api_exec = require("./migrations/nc_004_api_calls");
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
let ClickhouseService = ClickhouseService_1 = class ClickhouseService {
    async execute(query, isInsert = false) {
        if (!this.client)
            return;
        return isInsert
            ? this.client.insert(query).toPromise()
            : this.client.query(query).toPromise();
    }
    onModuleDestroy() { }
    async onModuleInit() {
        var _a, _b, _c, _d;
        const { connection, protocol } = await ClickhouseService_1.metaUrlToDbConfig(process.env.NC_CLICKHOUSE);
        this.config = {
            host: (_b = `${protocol !== null && protocol !== void 0 ? protocol : 'http'}://${(_a = connection.host) !== null && _a !== void 0 ? _a : 'localhost'}`) !== null && _b !== void 0 ? _b : 'http://localhost',
            port: (_c = connection.port) !== null && _c !== void 0 ? _c : 8123,
            username: connection.user,
            password: connection.password,
            database: (_d = connection.database) !== null && _d !== void 0 ? _d : 'nc',
        };
        const clickhouse = new clickhouse_1.ClickHouse(Object.assign(Object.assign({}, this.config), { database: undefined }));
        for (const { up } of [
            nc_001_notification,
            nc_002_page,
            nc_003_api_count,
            nc_004_api_exec,
        ]) {
            await up(clickhouse, this.config);
        }
        this.client = new clickhouse_1.ClickHouse(this.config);
    }
    static metaUrlToDbConfig(urlString) {
        const url = new URL(urlString);
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
        return {
            protocol: url.protocol.replace(':', ''),
            connection: Object.assign(Object.assign({}, parsedQuery), { host: url.hostname, port: +url.port }),
        };
    }
};
ClickhouseService = ClickhouseService_1 = __decorate([
    (0, common_1.Injectable)()
], ClickhouseService);
exports.ClickhouseService = ClickhouseService;
//# sourceMappingURL=clickhouse.service.js.map