"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const microservices_1 = require("@nestjs/microservices");
const kafkajs_1 = require("kafkajs");
class KafkaConsumerServer extends microservices_1.Server {
    constructor() {
        super();
        this.kafka = new kafkajs_1.Kafka({
            clientId: 'my-consumer',
            brokers: ['localhost:9092'],
        });
    }
    async listen(callback) {
        this.consumer = this.kafka.consumer({
            groupId: 'my-group',
            minBytes: 1000,
        });
        await this.consumer.connect();
        for (const topic of this.messageHandlers.keys()) {
            await this.consumer.subscribe({ topic, fromBeginning: true });
        }
        await this.consumer.run({
            eachBatch: async ({ batch }) => {
                console.log(`Received batch with ${batch.messages.length} messages`);
                const rows = [];
                if (this.messageHandlers.has(batch.topic)) {
                    batch.messages.forEach(({ key, value }) => {
                        rows.push(JSON.parse(value.toString()));
                    });
                    await this.messageHandlers.get(batch.topic)(rows, batch);
                }
            },
        });
    }
    close() {
        this.consumer && this.consumer.disconnect();
    }
}
exports.default = KafkaConsumerServer;
//# sourceMappingURL=kafka-consumer-server.js.map