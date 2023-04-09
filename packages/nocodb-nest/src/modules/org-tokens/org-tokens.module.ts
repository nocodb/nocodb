import { Module } from '@nestjs/common';
import { OrgTokensService } from './org-tokens.service';
import { OrgTokensController } from './org-tokens.controller';
import { OrgTokensEeService } from './ee/org-tokens/org-tokens.service';

@Module({
  controllers: [OrgTokensController],
  providers: [OrgTokensEeService]
})
export class OrgTokensModule {}
