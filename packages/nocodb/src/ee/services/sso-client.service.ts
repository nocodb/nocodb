import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '~/interface/config';

@Injectable()
export class SsoClientService {
  constructor(protected readonly configService: ConfigService<AppConfig>) {}
}
