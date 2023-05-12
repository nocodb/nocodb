import {Controller, Get, OnModuleDestroy, OnModuleInit} from '@nestjs/common';
import {Client, ClientKafka, MessagePattern, Payload, Transport} from '@nestjs/microservices';
import { ClickhouseService } from './clickhouse/clickhouse.service';

@Controller()
export class AppController implements OnModuleInit{
  //
  // @Client({
  //   transport: Transport.KAFKA,
  //   options: {
  //     client: {
  //       clientId: 'hero',
  //       brokers: ['localhost:9092'],
  //     },
  //     consumer: {
  //       groupId: 'group-1'
  //     }
  //   }
  // })
  // client: ClientKafka;





  constructor(private readonly clickhouseService: ClickhouseService,
              // private readonly client:ClientKafka
              ) {}

  @MessagePattern('api_exec_time')
  syncApiExecTime(@Payload() message: any): any {
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

  // onModuleInit(): any {
  //
  //   const consumer = this.client.subscribeToResponseOf(
  //     'my-group')
  //
  //   const runConsumer = async () => {
  //     await consumer.connect();
  //     await consumer.subscribe({topic: 'api_exec_time', fromBeginning: true});
  //
  //     await consumer.run({
  //       eachBatch: async ({batch}) => {
  //         console.log(`Received batch with ${batch.messages.length} messages`);
  //
  //         // Process the batch of messages
  //         batch.messages.forEach(({key, value}) => {
  //           console.log(`Key: ${(key || '').toString()}, Value: ${value.toString()}`);
  //           // Process each message within the batch
  //         });
  //
  //         // Commit the offset for the processed batch
  //         // await batch.commit();
  //       },
  //     });
  //   }
  //
  //
  //     this.client.
  // }


  // @MessagePattern({ cmd: 'batchMessage' })
  // async handleBatchMessage(payload: any) {
  //
  //   this.client.
  //
  //   const { batch } = payload;
  //
  //   console.log(`Received batch with ${batch.messages.length} messages`);
  //
  //   batch.messages.forEach(({ key, value }) => {
  //     console.log(`Key: ${key.toString()}, Value: ${value.toString()}`);
  //     // Process each message within the batch
  //   });
  //
  //   // Commit the offset for the processed batch
  //   await batch.commit();
  // }
}
