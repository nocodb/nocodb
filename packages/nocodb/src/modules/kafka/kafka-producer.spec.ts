import { Test, TestingModule } from '@nestjs/testing';
import { KafkaConsumerService } from './kafka-producer';

describe('KafkaConsumerService', () => {
  let service: KafkaConsumerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KafkaConsumerService],
    }).compile();

    service = module.get<KafkaConsumerService>(KafkaConsumerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
