import { Test } from '@nestjs/testing';
import { CalendarsService } from '../services/calendars.service';
import { CalendarsController } from './calendars.controller';
import type { TestingModule } from '@nestjs/testing';

describe('CalendarsController', () => {
  let controller: CalendarsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CalendarsController],
      providers: [CalendarsService],
    }).compile();

    controller = module.get<CalendarsController>(CalendarsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
