import { Module } from '@nestjs/common';
import { OrgTokensEeService } from './ee/org-tokens/org-tokens-ee.service';
import { OrgTokensService } from './org-tokens.service';
import { OrgTokensController } from './org-tokens.controller';

@Module({
  controllers: [OrgTokensController],
  providers: [OrgTokensEeService, OrgTokensService],
})
export class OrgTokensModule {}
