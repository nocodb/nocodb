import { Controller, Get, Response } from '@nestjs/common';

@Controller()
export class EnvController {
  @Get(['/api/v1/db/meta/env'])
  async getEnv(@Response() res) {
    res.setHeader('Content-Type', 'application/json');
    res.send(
      JSON.stringify({
        PROJECTS_TITLE: process.env.PROJECTS_TITLE,
        LOGO_URL: process.env.LOGO_URL,
        LOGO_TEXT: process.env.LOGO_TEXT,
        LOGO_WIDTH: process.env.LOGO_WIDTH,
        LOGO_HREF: process.env.LOGO_HREF,
        ICON_URL: process.env.ICON_URL,
        ICON_TEXT: process.env.ICON_TEXT,
        ICON_WIDTH: process.env.ICON_WIDTH,
      }),
    );
  }
}
