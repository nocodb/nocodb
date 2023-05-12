import { Controller, HttpCode, Post, Request, UseGuards } from '@nestjs/common';
import { Acl } from '../middlewares/extract-project-id/extract-project-id.middleware';
import { GlobalGuard } from '../guards/global/global.guard';
import { CommandPaletteService } from '../services/command-palette.service';
import type { UserType } from 'nocodb-sdk';

@Controller()
@UseGuards(GlobalGuard)
export class CommandPaletteController {
  constructor(private commandPaletteService: CommandPaletteService) {}

  @Post('/api/v1/command_palette')
  @Acl('commandPalette')
  @HttpCode(200)
  async commandPalette(@Request() req) {
    const data = this.commandPaletteService.commandPalette({
      user: req?.user as UserType,
      body: req.body,
    });

    return data;
  }
}
