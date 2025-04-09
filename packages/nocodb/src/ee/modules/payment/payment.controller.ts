import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import Ajv from 'ajv';
import {
  NcRequest,
  type PlanFeatureTypes,
  type PlanLimitTypes,
} from 'nocodb-sdk';
import { PaymentService } from '~/modules/payment/payment.service';
import { planSchema } from '~/modules/payment/payment.helper';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { extractProps } from '~/helpers/extractProps';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

const ajv = new Ajv();

const validatePlan = ajv.compile(planSchema);

@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @UseGuards(AuthGuard('basic'))
  @Post('/api/internal/payment/plan')
  async submitPlan(
    @Body()
    payload: {
      stripe_product_id: string;
      is_active?: boolean;
    },
  ) {
    const valid = validatePlan(payload);

    if (!valid) {
      throw new Error(ajv.errorsText(validatePlan.errors));
    }

    return this.paymentService.submitPlan(payload);
  }

  @UseGuards(AuthGuard('basic'))
  @Patch('/api/internal/payment/plan/:planId')
  async syncPlan(
    @Param('planId') planId: string,
    @Body()
    payload: {
      is_active?: boolean;
    },
  ) {
    return this.paymentService.syncPlan(planId, payload);
  }

  @UseGuards(AuthGuard('basic'))
  @Delete('/api/internal/payment/plan/:planId')
  async disablePlan(@Param('planId') planId: string) {
    return this.paymentService.disablePlan(planId);
  }

  @UseGuards(AuthGuard('basic'))
  @Get('/api/internal/payment/plan')
  async getAllPlans() {
    return this.paymentService.getPlans();
  }

  @UseGuards(PublicApiLimiterGuard)
  @Get('/api/public/payment/plan')
  async getPlans() {
    const plans = await this.paymentService.getPlans();

    return plans.map((plan) => {
      return extractProps(plan, [
        'id',
        'title',
        'description',
        'stripe_product_id',
        'prices',
        'descriptions',
        'is_active',
      ]);
    });
  }

  @UseGuards(GlobalGuard)
  @HttpCode(200)
  @Get('/api/payment/:workspaceOrOrgId/seat-count')
  @Acl('paymentSeatCount', {
    scope: 'workspace',
  })
  async seatCount(
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Req() _req: NcRequest,
  ) {
    return {
      count: await this.paymentService.getSeatCount(workspaceOrOrgId),
    };
  }

  @UseGuards(GlobalGuard)
  @HttpCode(200)
  @Post('/api/payment/:workspaceOrOrgId/create-subscription-form')
  @Acl('manageSubscription', {
    scope: 'workspace',
  })
  async createSubscriptionForm(
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Body() payload: any,
    @Req() req: NcRequest,
  ) {
    return this.paymentService.createSubscriptionForm(
      workspaceOrOrgId,
      payload,
      req,
    );
  }

  @UseGuards(GlobalGuard)
  @HttpCode(200)
  @Post('/api/payment/:workspaceOrOrgId/update-subscription')
  @Acl('manageSubscription', {
    scope: 'workspace',
  })
  async updateSubscription(
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Body() payload: any,
    @Req() req: NcRequest,
  ) {
    return this.paymentService.updateSubscription(
      workspaceOrOrgId,
      payload,
      req,
    );
  }

  @UseGuards(GlobalGuard)
  @HttpCode(200)
  @Delete('/api/payment/:workspaceOrOrgId/cancel-subscription')
  @Acl('manageSubscription', {
    scope: 'workspace',
  })
  async cancelSubscription(
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Req() req: NcRequest,
  ) {
    return this.paymentService.cancelSubscription(workspaceOrOrgId, req);
  }

  @UseGuards(GlobalGuard)
  @HttpCode(200)
  @Post('/api/payment/:workspaceOrOrgId/recover-subscription')
  @Acl('manageSubscription', {
    scope: 'workspace',
  })
  async recoverSubscription(
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
  ) {
    return this.paymentService.recoverSubscription(workspaceOrOrgId);
  }

  @UseGuards(GlobalGuard)
  @HttpCode(200)
  @Get('/api/payment/:workspaceOrOrgId/get-session-result/:sessionId')
  @Acl('manageSubscription', {
    scope: 'workspace',
  })
  async getCheckoutSession(
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.paymentService.getCheckoutSession(workspaceOrOrgId, sessionId);
  }

  @UseGuards(GlobalGuard)
  @HttpCode(200)
  @Get('/api/payment/:workspaceOrOrgId/customer-portal')
  @Acl('manageSubscription', {
    scope: 'workspace',
  })
  async getCustomerPortal(
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Req() req: NcRequest,
  ) {
    return this.paymentService.getCustomerPortal(workspaceOrOrgId, req);
  }

  @UseGuards(GlobalGuard)
  @HttpCode(200)
  @Get('/api/payment/:workspaceOrOrgId/invoice')
  @Acl('manageSubscription', {
    scope: 'workspace',
  })
  async getInvoice(
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Query('starting_after') starting_after: string,
    @Query('ending_before') ending_before: string,
  ) {
    return this.paymentService.listInvoice(workspaceOrOrgId, {
      starting_after,
      ending_before,
    });
  }

  @UseGuards(GlobalGuard)
  @HttpCode(200)
  @Post('/api/payment/:workspaceOrOrgId/request-upgrade')
  @Acl('requestUpgrade', {
    scope: 'workspace',
  })
  async requestUpgrade(
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Body()
    payload: {
      limitOrFeature: PlanLimitTypes | PlanFeatureTypes;
    },
    @Req() req: NcRequest,
  ) {
    return this.paymentService.requestUpgrade(workspaceOrOrgId, payload, req);
  }

  @Post('/api/payment/webhook')
  async webhookListener(@Req() req: NcRequest) {
    return this.paymentService.handleWebhook(req);
  }
}
