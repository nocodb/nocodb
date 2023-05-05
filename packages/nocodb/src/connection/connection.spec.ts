import { Test } from '@nestjs/testing';
import { Connection } from './knex';
import type { TestingModule } from '@nestjs/testing';

describe('Knex', () => {
  let provider: Connection;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Connection],
    }).compile();

    provider = module.get<Connection>(Connection);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
