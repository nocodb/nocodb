import { Test, TestingModule } from '@nestjs/testing';
import { CommandPaletteController } from './command-palette.controller';

describe('CommandPaletteController', () => {
  let controller: CommandPaletteController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommandPaletteController],
    }).compile();

    controller = module.get<CommandPaletteController>(CommandPaletteController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
