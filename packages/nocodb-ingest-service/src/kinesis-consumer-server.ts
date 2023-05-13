import {CustomTransportStrategy, Server} from '@nestjs/microservices';
import * as AWS from 'aws-sdk';
import * as Knex from 'knex';
import NcConfigFactory from './helpers/NcConfigFactory';
import {Kinesis} from 'aws-sdk';

export default class KinesisConsumerServer
  extends Server
  implements CustomTransportStrategy {
  private kinesis: AWS.Kinesis;
  private knex: Knex.Knex;

  constructor() {
    super();
    this.kinesis = new AWS.Kinesis({region: 'us-east-2'});
  }

  /**
   * This method is triggered when you run "app.listen()".
   */
  async listen(callback: () => void) {
    const config = await NcConfigFactory.make();
    this.knex = Knex.default({
      ...config.meta.db,
      useNullAsDefault: true,
    });

    for (const topic of this.messageHandlers.keys()) {
      const startingSequenceNum = await this.getLastIngestedSequenceKey(topic);

      const params: Kinesis.Types.GetShardIteratorInput = {
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
        } else {
          const shardIterator = data.ShardIterator;

          const params: Kinesis.Types.GetRecordsInput = {
            ShardIterator: shardIterator,
            Limit: 300,
          };

          const readRecords = () => {
            this.kinesis.getRecords(params, async (err, data) => {
              if (err) {
                this.logger.log(err, err.stack);
              } else {
                const records = data.Records;
                if (records.length > 0) {
                  this.logger.log('Received ' + records.length + ' records:');
                  const parsedRecords = records
                    .map((record) => {
                      const decodedData = Buffer.from(
                        record.Data as any,
                        'base64',
                      ).toString();
                      try {
                        return JSON.parse(decodedData);
                      } catch (error) {
                        this.logger.error('Error parsing record data:', error);
                        return null;
                      }
                    })
                    .filter(Boolean);
                  await this.messageHandlers.get(topic)(parsedRecords);
                  await this.setLastIngestedSequenceKey(
                    topic,
                    records[records.length - 1].SequenceNumber,
                  );
                }
                params.ShardIterator = data.NextShardIterator;

                await new Promise((resolve) => setTimeout(resolve, 1000));

                readRecords();
              }
            });
          };

          readRecords();
        }
      });
    }
  }

  /**
   * This method is triggered on application shutdown.
   */
  close() {
  }

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
      await this.knex('nc_store').update({value: sequenceNum}).where({
        id: result.id,
      });
    } else {
      await this.knex('nc_store').insert({
        key: `last_ingested:${stream}`,
        value: sequenceNum,
      });
    }
  }
}
