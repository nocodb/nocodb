"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const kinesis_consumer_server_1 = require("./kinesis-consumer-server");
async function bootstrap() {
    const app = await core_1.NestFactory.createMicroservice(app_module_1.AppModule, {
        strategy: new kinesis_consumer_server_1.default(),
    });
    await app.listen();
}
bootstrap();
//# sourceMappingURL=main.js.map