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
import { Subscription, Workspace } from '~/models';
import { NcError } from '~/helpers/ncError';

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
  @Patch('/api/internal/payment/plan')
  async syncAllPlans() {
    return this.paymentService.syncAllPlans();
  }

  @UseGuards(AuthGuard('basic'))
  @Delete('/api/internal/payment/plan/:planId')
  async disablePlan(@Param('planId') planId: string) {
    return this.paymentService.disablePlan(planId);
  }

  @UseGuards(AuthGuard('basic'))
  @Post('/api/internal/payment/:workspaceOrOrgId/upgrade')
  async upgradeSubscription(
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Body() payload: { plan: string },
  ) {
    return this.paymentService.internalUpgrade(workspaceOrOrgId, payload.plan);
  }

  @UseGuards(AuthGuard('basic'))
  @Post('/api/internal/payment/:workspaceOrOrgId/reseat')
  async reseatSubscription(
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
  ) {
    return this.paymentService.reseatSubscriptionAwaited(workspaceOrOrgId);
  }

  @UseGuards(AuthGuard('basic'))
  @Post('/api/internal/payment/:workspaceOrOrgId/update')
  async updateWorkspacePaymentMetadata(
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Body()
    payload: {
      segment_code?: number;
      loyal?: boolean;
      loyalty_discount_used?: boolean;
    },
  ) {
    return Workspace.update(workspaceOrOrgId, {
      loyal: payload.loyal,
      loyalty_discount_used: payload.loyalty_discount_used,
      segment_code: payload.segment_code,
    });
  }

  @UseGuards(AuthGuard('basic'))
  @Patch('/api/internal/payment/:workspaceOrOrgId/meta')
  async updateSubscriptionMeta(
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Body()
    payload: { [key in PlanLimitTypes]: number } & {
      [key in PlanFeatureTypes]: boolean;
    },
  ) {
    const subscription = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
    );

    if (!subscription) {
      NcError.genericNotFound('Subscription', workspaceOrOrgId);
    }

    return Subscription.update(subscription.id, {
      meta: payload,
    });
  }

  @UseGuards(AuthGuard('basic'))
  @Post('/api/internal/payment/:workspaceOrOrgId/create-customer')
  async createCustomer(
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Body() payload: { userId: string },
  ) {
    return this.paymentService.createStripeCustomer(
      workspaceOrOrgId,
      payload.userId,
    );
  }

  @UseGuards(AuthGuard('basic'))
  @Post('/api/internal/payment/:workspaceOrOrgId/recover')
  async syncSubscription(@Param('workspaceOrOrgId') workspaceOrOrgId: string) {
    return this.paymentService.recoverSubscription(workspaceOrOrgId);
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

  @UseGuards(PublicApiLimiterGuard)
  @Get('/api/public/payment/plan/:planId')
  async getPlan(@Param('planId') planId: string) {
    const plan = await this.paymentService.getPlan(planId);

    return extractProps(plan, [
      'id',
      'title',
      'description',
      'stripe_product_id',
      'prices',
      'descriptions',
      'is_active',
    ]);
  }

  @UseGuards(GlobalGuard)
  @HttpCode(200)
  @Get('/api/payment/:workspaceOrOrgId/seat-count')
  @Acl('paymentSeatCount', {
    scope: 'cloud-org',
    extendedScope: 'workspace',
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
    scope: 'cloud-org',
    extendedScope: 'workspace',
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
    scope: 'cloud-org',
    extendedScope: 'workspace',
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
    scope: 'cloud-org',
    extendedScope: 'workspace',
  })
  async cancelSubscription(
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
  ) {
    return this.paymentService.cancelSubscription(workspaceOrOrgId);
  }

  @UseGuards(GlobalGuard)
  @HttpCode(200)
  @Post('/api/payment/:workspaceOrOrgId/recover-subscription')
  @Acl('manageSubscription', {
    scope: 'cloud-org',
    extendedScope: 'workspace',
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
    scope: 'cloud-org',
    extendedScope: 'workspace',
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
    scope: 'cloud-org',
    extendedScope: 'workspace',
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
    scope: 'cloud-org',
    extendedScope: 'workspace',
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
