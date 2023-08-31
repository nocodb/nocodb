import { Controller, HttpCode, Post, Request, UseGuards } from '@nestjs/common';
import type { UserType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { CommandPaletteService } from '~/services/command-palette.service';

@Controller()
@UseGuards(GlobalGuard)
export class CommandPaletteController {
  constructor(private commandPaletteService: CommandPaletteService) {}

  @Post('/api/v1/command_palette')
  @HttpCode(200)
  async commandPalette(@Request() req) {
    const data = this.commandPaletteService.commandPalette({
      user: req?.user as UserType,
      body: req.body,
    });

    return data;
  }
}
