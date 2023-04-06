import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UtilsService } from './utils.service';

@Controller('/')
export class UtilsController {
  constructor(private readonly utilsService: UtilsService) {}


  @Get('/api/v1/db/meta/nocodb/info')
  info() {
    return this.utilsService.info();
  }


  @Get('/api/v1/version')
  version() {
    return this.utilsService.versionInfo();
  }

}
