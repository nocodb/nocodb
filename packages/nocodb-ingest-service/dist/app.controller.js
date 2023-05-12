"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const clickhouse_service_1 = require("./clickhouse/clickhouse.service");
let AppController = class AppController {
    constructor(clickhouseService) {
        this.clickhouseService = clickhouseService;
    }
    async syncApiExecTime(messages) {
        const rows = [];
        messages.forEach((data) => {
            var _a;
            if (!data.url)
                return;
            const { workspace_id, user_id, project_id, url, method, status, exec_time, timestamp, } = data;
            rows.push(`(${(_a = Math.round(timestamp / 1000)) !== null && _a !== void 0 ? _a : 'NOW()'}, '${workspace_id}', '${user_id}', '${project_id}', '${url}', '${method}', ${exec_time}, ${status !== null && status !== void 0 ? status : 'NULL'})`);
        });
        const insertQuery = `INSERT INTO api_calls (timestamp, workspace_id, user_id, project_id, url, method, exec_time, status) 
                         VALUES ${rows.join(',')}`;
        await this.clickhouseService.execute(insertQuery);
    }
};
__decorate([
    (0, microservices_1.MessagePattern)(process.env.NC_KINESIS_STREAM || 'nocohub-dev-input-stream'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "syncApiExecTime", null);
AppController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [clickhouse_service_1.ClickhouseService])
], AppController);
exports.AppController = AppController;
//# sourceMappingURL=app.controller.js.map