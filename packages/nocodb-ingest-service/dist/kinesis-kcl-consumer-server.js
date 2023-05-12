"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const microservices_1 = require("@nestjs/microservices");
const aws_kcl_1 = require("aws-kcl");
class KinesisConsumerServer extends microservices_1.Server {
    constructor() {
        super();
    }
    async listen(callback) {
        const recordProcessor = {
            initialize: function (initializeInput, completeCallback) {
                completeCallback();
            },
            processRecords: function (processRecordsInput, completeCallback) {
                if (!processRecordsInput || !processRecordsInput.records) {
                    completeCallback();
                    return;
                }
                var records = processRecordsInput.records;
                var record, sequenceNumber, partitionKey, data;
                for (var i = 0; i < records.length; ++i) {
                    record = records[i];
                    sequenceNumber = record.sequenceNumber;
                    partitionKey = record.partitionKey;
                    data = new Buffer(record.data, 'base64').toString();
                }
                if (!sequenceNumber) {
                    completeCallback();
                    return;
                }
                processRecordsInput.checkpointer.checkpoint(sequenceNumber, function (err, checkpointedSequenceNumber) {
                    completeCallback();
                });
            },
            leaseLost: function (leaseLostInput, completeCallback) {
                completeCallback();
            },
            shardEnded: function (shardEndedInput, completeCallback) {
                shardEndedInput.checkpointer.checkpoint(function (err) {
                    completeCallback();
                });
                completeCallback();
            }
        };
        (0, aws_kcl_1.default)(recordProcessor).run();
    }
    close() { }
}
exports.default = KinesisConsumerServer;
//# sourceMappingURL=kinesis-kcl-consumer-server.js.map