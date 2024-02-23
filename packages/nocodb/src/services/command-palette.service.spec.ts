import { Test } from '@nestjs/testing';
import { CommandPaletteService } from './command-palette.service';
import type { TestingModule } from '@nestjs/testing';

describe('CommandPaletteService', () => {
  let service: CommandPaletteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommandPaletteService],
    }).compile();

    service = module.get<CommandPaletteService>(CommandPaletteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
