import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { NcRequest } from 'nocodb-sdk';

const NOT_FOUND_PATH_PREFIX = '/api/v3/*';

@Controller()
export class NotFoundV3Controller {
  @Get(NOT_FOUND_PATH_PREFIX)
  @Put(NOT_FOUND_PATH_PREFIX)
  @Post(NOT_FOUND_PATH_PREFIX)
  @Patch(NOT_FOUND_PATH_PREFIX)
  @Delete(NOT_FOUND_PATH_PREFIX)
  @HttpCode(404)
  async notFoundV3(@Req() req: NcRequest) {
    return {
      error: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
    };
  }
}
