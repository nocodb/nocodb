import { Controller } from '@nestjs/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PlanFeatureTypes } from 'nocodb-sdk';
import type {
  TeamDetailV3Type,
  TeamMembersAddV3ReqType,
  TeamMembersRemoveV3ReqType,
  TeamMembersUpdateV3ReqType,
  TeamV3ResponseType,
} from '~/ee/services/v3/teams-v3.types';
import {
  TeamCreateV3ReqType,
  TeamUpdateV3ReqType,
} from '~/ee/services/v3/teams-v3.types';
import { GlobalGuard } from '~/guards/global/global.guard';
import { TeamsV3Service } from '~/ee/services/v3/teams-v3.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { getFeature } from '~/helpers/paymentHelpers';
import { NcError } from '~/helpers/catchError';

@Controller()
export class TeamsV3Controller {
  constructor() {}
}
