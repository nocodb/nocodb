import { Injectable } from '@nestjs/common';
// import { KafkaService } from 'nestjs-kafka';
import type { OnModuleInit } from '@nestjs/common';
import {KafkaService} from "../../services/kafka/kafka.service";

@Injectable()
export class KafkaConsumer implements OnModuleInit {
  constructor(private readonly kafkaService: KafkaService) {}


  onMessage(onMessage: any, arg1: string) {
    console.log('onMessage', onMessage, arg1);
  }

  async onModuleInit() {
    // await this.kafkaService.bindAllTopicToConsumer(this.onMessage, 'test');
  }
}
