import { Test } from '@nestjs/testing';
import { DataAliasNestedController } from './data-alias-nested.controller';
import type { TestingModule } from '@nestjs/testing';

describe('DataAliasNestedController', () => {
  let controller: DataAliasNestedController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DataAliasNestedController],
    }).compile();

    controller = module.get<DataAliasNestedController>(
      DataAliasNestedController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
