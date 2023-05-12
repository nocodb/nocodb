"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const microservices_1 = require("@nestjs/microservices");
const AWS = require("aws-sdk");
const Knex = require("knex");
const NcConfigFactory_1 = require("./helpers/NcConfigFactory");
class KinesisConsumerServer extends microservices_1.Server {
    constructor() {
        super();
        this.kinesis = new AWS.Kinesis({ region: 'us-east-2' });
    }
    async listen(callback) {
        const config = await NcConfigFactory_1.default.make();
        this.knex = Knex.default(Object.assign(Object.assign({}, config.meta.db), { useNullAsDefault: true }));
        for (const topic of this.messageHandlers.keys()) {
            const startingSequenceNum = await this.getLastIngestedSequenceKey(topic);
            const params = {
                ShardIteratorType: startingSequenceNum
                    ? 'AFTER_SEQUENCE_NUMBER'
                    : 'TRIM_HORIZON',
                StreamName: topic,
                ShardId: 'shardId-000000000000',
                StartingSequenceNumber: startingSequenceNum,
            };
            this.kinesis.getShardIterator(params, (err, data) => {
                if (err) {
                    console.log(err, err.stack);
                }
                else {
                    const shardIterator = data.ShardIterator;
                    const params = {
                        ShardIterator: shardIterator,
                    };
                    const readRecords = () => {
                        this.kinesis.getRecords(params, async (err, data) => {
                            if (err) {
                                console.log(err, err.stack);
                            }
                            else {
                                const records = data.Records;
                                if (records.length > 0) {
                                    console.log('Received', records.length, 'records:');
                                    const parsedRecords = records
                                        .map((record) => {
                                        const decodedData = Buffer.from(record.Data, 'base64').toString();
                                        try {
                                            return JSON.parse(decodedData);
                                        }
                                        catch (error) {
                                            console.error('Error parsing record data:', error);
                                            return null;
                                        }
                                    })
                                        .filter(Boolean);
                                    await this.messageHandlers.get(topic)(parsedRecords);
                                    await this.setLastIngestedSequenceKey(topic, records[records.length - 1].SequenceNumber);
                                }
                                params.ShardIterator = data.NextShardIterator;
                                readRecords();
                            }
                        });
                    };
                    readRecords();
                }
            });
        }
    }
    close() { }
    async getLastIngestedSequenceKey(stream = '') {
        const result = await this.knex('nc_store')
            .select('value')
            .where('key', `last_ingested:${stream}`)
            .first();
        if (result) {
            return result.value;
        }
    }
    async setLastIngestedSequenceKey(stream = '', sequenceNum) {
        const result = await this.knex('nc_store')
            .select('id')
            .where('key', `last_ingested:${stream}`)
            .first();
        if (result) {
            await this.knex('nc_store').update({ value: sequenceNum }).where({
                id: result.id,
            });
        }
        else {
            await this.knex('nc_store').insert({
                key: `last_ingested:${stream}`,
                value: sequenceNum,
            });
        }
    }
}
exports.default = KinesisConsumerServer;
//# sourceMappingURL=kinesis-consumer-server.js.map