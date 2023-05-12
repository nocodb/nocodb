import { Injectable } from '@nestjs/common';
// import { KafkaService } from 'nestjs-kafka';
import {KafkaService} from "../../services/kafka/kafka.service";

@Injectable()
export class KafkaProducer {
  constructor(private readonly kafkaService: KafkaService) {}

  async sendMessage(topic: string, message: string) {
    await this.kafkaService.sendMessage(topic, message);
  }
}
