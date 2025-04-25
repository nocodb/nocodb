import {
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { NcRequest } from 'nocodb-sdk';

const V1_PATH_PREFIX = '/api/v1/*';
const V2_PATH_PREFIX = '/api/v2/*';
const NOT_FOUND_PATH_PREFIX = '/api/:apiVersion/*';

@Controller()
export class ApiVersionNotFoundController {
  @Get([V1_PATH_PREFIX, V2_PATH_PREFIX])
  @Put([V1_PATH_PREFIX, V2_PATH_PREFIX])
  @Post([V1_PATH_PREFIX, V2_PATH_PREFIX])
  @Patch([V1_PATH_PREFIX, V2_PATH_PREFIX])
  @Delete([V1_PATH_PREFIX, V2_PATH_PREFIX])
  @HttpCode(404)
  async apiVersion1And2NotFound(@Req() req: NcRequest) {
    throw new NotFoundException(`Cannot ${req.method} ${req.path}`);
  }

  @Get(NOT_FOUND_PATH_PREFIX)
  @Put(NOT_FOUND_PATH_PREFIX)
  @Post(NOT_FOUND_PATH_PREFIX)
  @Patch(NOT_FOUND_PATH_PREFIX)
  @Delete(NOT_FOUND_PATH_PREFIX)
  @HttpCode(404)
  async apiVersionNotFound(@Req() req: NcRequest) {
    return {
      error: 'INVALID_API_VERSION',
      message: `Cannot ${req.method} ${req.path}`,
    };
  }
}
