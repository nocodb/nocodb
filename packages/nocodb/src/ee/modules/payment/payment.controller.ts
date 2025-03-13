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
import { AuthGuard } from '@nestjs/passport';
import Ajv from 'ajv';
import { NcRequest } from 'nocodb-sdk';
import { PaymentService } from '~/modules/payment/payment.service';
import { planSchema } from '~/modules/payment/payment.helper';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { extractProps } from '~/helpers/extractProps';
import { GlobalGuard } from '~/guards/global/global.guard';

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
  async syncPlan(@Param('planId') planId: string) {
    return this.paymentService.syncPlan(planId);
  }

  @UseGuards(AuthGuard('basic'))
  @Delete('/api/internal/payment/plan/:planId')
  async disablePlan(@Param('planId') planId: string) {
    return this.paymentService.disablePlan(planId);
  }

  @UseGuards(AuthGuard('basic'))
  @Get('/api/internal/payment/plan')
  async getAllPlans() {
    return this.paymentService.getPlans(false);
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
        'meta',
      ]);
    });
  }

  @UseGuards(GlobalGuard)
  @HttpCode(200)
  @Get('/api/payment/:workspaceOrOrgId/seat-count')
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
  @Post('/api/payment/:workspaceOrOrgId/create-subscription')
  async createSubscription(
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Body() payload: any,
    @Req() req: NcRequest,
  ) {
    return this.paymentService.createSubscription(
      workspaceOrOrgId,
      payload,
      req,
    );
  }

  @UseGuards(GlobalGuard)
  @HttpCode(200)
  @Post('/api/payment/:workspaceOrOrgId/update-subscription')
  async updateSubscription(
    @Param('workspaceId') workspaceOrOrgId: string,
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
  async cancelSubscription(
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Req() req: NcRequest,
  ) {
    return this.paymentService.cancelSubscription(workspaceOrOrgId, req);
  }

  @Post('/api/payment/webhook')
  async webhookListener(@Req() req: NcRequest) {
    return this.paymentService.handleWebhook(req);
  }
}
