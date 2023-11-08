import { Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import type { UserType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { CommandPaletteService } from '~/services/command-palette.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class CommandPaletteController {
  constructor(private commandPaletteService: CommandPaletteService) {}

  @Post('/api/v1/command_palette')
  @Acl('commandPalette', {
    scope: 'org',
  })
  @HttpCode(200)
  async commandPalette(@Req() req: Request) {
    const data = this.commandPaletteService.commandPalette({
      user: req?.user as UserType,
      body: req.body,
    });

    return data;
  }
}
