import { Controller, Delete, Get, UseGuards } from '@nestjs/common';
import { OrgUserRoles } from 'nocodb-sdk';
import { CachesService } from '~/services/caches.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class CachesController {
  constructor(private readonly cachesService: CachesService) {}

  @Get(['/api/v1/db/meta/cache', '/api/v2/meta/cache'])
  @Acl('cacheGet', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async cacheGet(_, res) {
    const data = await this.cachesService.cacheGet();
    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="cache-export.json"`,
    });
    return JSON.stringify(data);
  }

  @Delete(['/api/v1/db/meta/cache', '/api/v2/meta/cache'])
  @Acl('cacheDelete', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async cacheDelete() {
    return await this.cachesService.cacheDelete();
  }
}
