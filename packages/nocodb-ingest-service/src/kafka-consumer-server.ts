import { CustomTransportStrategy, Server } from '@nestjs/microservices';
import { createMechanism } from '@jm18457/kafkajs-msk-iam-authentication-mechanism';
import { Kafka, Consumer, Admin, ITopicConfig } from 'kafkajs';

export default class KafkaConsumerServer
  extends Server
  implements CustomTransportStrategy
{
  private kafka: Kafka;
  private consumer: Consumer;
  private admin: Admin;

  constructor() {
    super();
    this.kafka = new Kafka({
      brokers: process.env.AWS_KAFKA_BROKERS.split(/\s*,\s*/),
      ssl: true,
      sasl: createMechanism({
        region: process.env.AWS_KAFKA_REGION,
        credentials: {
          accessKeyId: process.env.AWS_KAFKA_CLIENT_ID,
          secretAccessKey: process.env.AWS_KAFKA_CLIENT_SECRET,
        },
      }),
    });
  }

  /**
   * This method is triggered when you run "app.listen()".
   */
  async listen(callback: () => void) {
    this.admin = this.kafka.admin();

    // Create a new ClickHouse client instance
    this.consumer = this.kafka.consumer({
      groupId: 'my-group',
      minBytes: 10000,
    });
    await this.consumer.connect();

    for (const topic of this.messageHandlers.keys()) {
      await this.createTopicIfNotExists({
        topic,
        replicationFactor: +process.env.AWS_KAFKA_REPLICATION_FACTOR || 1,
        numPartitions: +process.env.AWS_KAFKA_NUM_PARTITIONS || 2,
      });
      await this.consumer.subscribe({ topic, fromBeginning: true });
    }

    await this.consumer.run({
      eachBatch: async ({ batch }) => {
        this.logger.log(
          `Received batch with ${batch.messages.length} messages`,
        );

        const rows = [];

        if (this.messageHandlers.has(batch.topic)) {
          batch.messages.forEach(({ key, value }) => {
            rows.push(JSON.parse(value.toString()));
          });
          await this.messageHandlers.get(batch.topic)(rows, batch);
        }
      },
    });

    callback();
  }

  /**
   * This method is triggered on application shutdown.
   */
  close() {
    this.consumer && this.consumer.disconnect();
  }

  async createTopicIfNotExists(topicConfig: ITopicConfig) {
    // Connect to the Kafka cluster
    await this.admin.connect();

    // Check if the topic exists
    const topicExists = await this.admin
      .listTopics()
      .then((topics) => topics.includes(topicConfig.topic));

    // If the topic doesn't exist, create it
    if (!topicExists) {
      await this.admin.createTopics({
        topics: [topicConfig],
      });

      console.log('Topic created successfully');
    } else {
      console.log('Topic already exists');
    }

    // Disconnect the admin client
    await this.admin.disconnect();
  }
}
