import {
  All,
  Controller,
  HttpCode,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { NcRequest } from 'nocodb-sdk';

const V1_PATH_PREFIX = '/api/v1/*';
const V2_PATH_PREFIX = '/api/v2/*';
const NOT_FOUND_PATH_PREFIX = '/api/:apiVersion/*';

@Controller()
export class ApiVersionNotFoundController {
  @All([V1_PATH_PREFIX, V2_PATH_PREFIX])
  @HttpCode(404)
  async apiVersion1And2NotFound(@Req() req: NcRequest) {
    throw new NotFoundException(`Cannot ${req.method} ${req.path}`);
  }

  @All(NOT_FOUND_PATH_PREFIX)
  @HttpCode(404)
  async apiVersionNotFound() {
    return {
      error: 'INVALID_API_VERSION',
      message: `API version unsupported`,
    };
  }
}
