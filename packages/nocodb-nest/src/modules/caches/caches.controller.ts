import { Controller } from '@nestjs/common';
import { CachesService } from './caches.service';

@Controller('caches')
export class CachesController {
  constructor(private readonly cachesService: CachesService) {}
}
