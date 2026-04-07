import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';
import { getGcpCredentials } from '~/services/gcp-credentials';

const BASE_URL = 'https://cloudcommerceprocurement.googleapis.com/v1';

export interface GcpProcurementAccount {
  name: string;
  provider: string;
  state: string;
  approvals?: Array<{
    name: string;
    state: string;
    reason?: string;
    updateTime?: string;
  }>;
  createTime?: string;
  updateTime?: string;
}

export interface GcpProcurementEntitlement {
  name: string;
  account: string;
  provider: string;
  product?: string;
  productExternalName?: string;
  plan: string;
  state: string;
  newPendingPlan?: string;
  offer?: string;
  usageReportingId?: string;
  consumers?: Array<{ project: string }>;
  createTime?: string;
  updateTime?: string;
  subscriptionEndTime?: string;
}

@Injectable()
export class GcpProcurementClient {
  private logger = new Logger(GcpProcurementClient.name);
  private auth: GoogleAuth;

  private get providerId(): string {
    return process.env.NC_GCP_MARKETPLACE_PROVIDER_ID || '';
  }

  constructor() {
    this.auth = new GoogleAuth({
      ...getGcpCredentials(),
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const client = await this.auth.getClient();
    const token = await client.getAccessToken();
    return {
      Authorization: `Bearer ${token.token}`,
      'Content-Type': 'application/json',
    };
  }

  private accountName(accountId: string): string {
    return `providers/${this.providerId}/accounts/${accountId}`;
  }

  private entitlementName(entitlementId: string): string {
    return `providers/${this.providerId}/entitlements/${entitlementId}`;
  }

  async getAccount(accountId: string): Promise<GcpProcurementAccount> {
    const headers = await this.getAuthHeaders();
    const name = this.accountName(accountId);
    const { data } = await axios.get(`${BASE_URL}/${name}`, { headers });
    return data;
  }

  async approveAccount(accountId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const name = this.accountName(accountId);

    await axios.post(
      `${BASE_URL}/${name}:approve`,
      { approvalName: 'signup' },
      { headers },
    );

    this.logger.log(`Approved GCP account: ${accountId}`);
  }

  async rejectAccount(accountId: string, reason: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const name = this.accountName(accountId);

    await axios.post(
      `${BASE_URL}/${name}:reject`,
      { approvalName: 'signup', reason },
      { headers },
    );

    this.logger.log(`Rejected GCP account: ${accountId}`);
  }

  async getEntitlement(
    entitlementId: string,
  ): Promise<GcpProcurementEntitlement> {
    const headers = await this.getAuthHeaders();
    const name = this.entitlementName(entitlementId);
    const { data } = await axios.get(`${BASE_URL}/${name}`, { headers });
    return data;
  }

  async listEntitlements(
    filter?: string,
  ): Promise<GcpProcurementEntitlement[]> {
    const headers = await this.getAuthHeaders();
    const parent = `providers/${this.providerId}`;
    const params: Record<string, string> = {};
    if (filter) params.filter = filter;

    const { data } = await axios.get(`${BASE_URL}/${parent}/entitlements`, {
      headers,
      params,
    });

    return data.entitlements || [];
  }

  async approveEntitlement(entitlementId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const name = this.entitlementName(entitlementId);

    await axios.post(`${BASE_URL}/${name}:approve`, {}, { headers });

    this.logger.log(`Approved GCP entitlement: ${entitlementId}`);
  }

  async rejectEntitlement(
    entitlementId: string,
    reason: string,
  ): Promise<void> {
    const headers = await this.getAuthHeaders();
    const name = this.entitlementName(entitlementId);

    await axios.post(`${BASE_URL}/${name}:reject`, { reason }, { headers });

    this.logger.log(`Rejected GCP entitlement: ${entitlementId}`);
  }

  async approveEntitlementPlanChange(
    entitlementId: string,
    pendingPlanName: string,
  ): Promise<void> {
    const headers = await this.getAuthHeaders();
    const name = this.entitlementName(entitlementId);

    await axios.post(
      `${BASE_URL}/${name}:approvePlanChange`,
      { pendingPlanName },
      { headers },
    );

    this.logger.log(
      `Approved GCP entitlement plan change: ${entitlementId} -> ${pendingPlanName}`,
    );
  }
}
