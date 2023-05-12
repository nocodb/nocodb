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
    syncApiExecTime(message) {
        return this.clickhouseService.execute(`
        INSERT INTO api_exec_time
        (
          timestamp,
          workspace_id,
          project_id,
          user_id,
          token,
          url,
          method,
          exec_time
        )
        VALUES (
          NOW(),
          '${message.workspace_id}',
          '${message.project_id}',
          '${message.user_id}',
          '${message.token}',
          '${message.url}',
          '${message.method}',
          ${message.exec_time}
          )
        `);
    }
};
__decorate([
    (0, microservices_1.MessagePattern)('api_exec_time'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], AppController.prototype, "syncApiExecTime", null);
AppController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [clickhouse_service_1.ClickhouseService])
], AppController);
exports.AppController = AppController;
//# sourceMappingURL=app.controller.js.map