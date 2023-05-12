import { CustomTransportStrategy, Server } from '@nestjs/microservices';

import { Kafka, Consumer } from 'kafkajs';

export default class KafkaConsumerServer
  extends Server
  implements CustomTransportStrategy
{
  private kafka: Kafka;
  private consumer: Consumer;

  constructor() {
    super();
    this.kafka = new Kafka({
      clientId: 'my-consumer',
      brokers: ['localhost:9092'],
    });
  }

  /**
   * This method is triggered when you run "app.listen()".
   */
  async listen(callback: () => void) {
    // Create a new ClickHouse client instance
    this.consumer = this.kafka.consumer({
      groupId: 'my-group',
      minBytes: 1000,
    });
    await this.consumer.connect();


    for(const topic of this.messageHandlers.keys()){
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

  /**
   * This method is triggered on application shutdown.
   */
  close() {
    this.consumer && this.consumer.disconnect();
  }
}
