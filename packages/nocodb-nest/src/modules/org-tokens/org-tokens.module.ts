import { Module } from '@nestjs/common';
import { OrgTokensEeService } from '../../services/org-tokens-ee.service';
import { OrgTokensService } from '../../services/org-tokens.service';
import { OrgTokensController } from '../../controllers/org-tokens.controller';

@Module({
  controllers: [OrgTokensController],
  providers: [OrgTokensEeService, OrgTokensService],
})
export class OrgTokensModule {}
