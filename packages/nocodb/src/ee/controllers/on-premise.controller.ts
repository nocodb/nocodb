import {
  Body,
  Controller,
  HttpCode,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import jwt from 'jsonwebtoken';
import { NcError } from '~/helpers/ncError';
import Installation, {
  InstallationStatus,
  LicenseType,
} from '~/models/Installation';
import Noco from '~/Noco';
import {
  LICENSE_CONFIG,
  LICENSE_SERVER_OLD_PUBLIC_KEY,
} from '~/constants/license.constants';

// Request envelope types
enum AgentRequestType {
  REGISTER = 'register',
  HEARTBEAT = 'heartbeat',
  TELEMETRY = 'telemetry',
}

enum AgentRequestVersion {
  V1 = LICENSE_CONFIG.AGENT_REQUEST_VERSION,
}

interface AgentRequestEnvelope {
  type: AgentRequestType;
  timestamp: number;
  version: AgentRequestVersion;
}

// Environment information interface
interface EnvironmentInfo {
  version?: string;
  platform?: string;
  domains?: string[]; // Array of accessed domains
}

// Activation request (extends envelope)
interface ActivationRequest extends AgentRequestEnvelope {
  type: AgentRequestType.REGISTER;
  license_key: string;
  environment?: EnvironmentInfo;
}

// Heartbeat request (extends envelope)
interface HeartbeatRequest extends AgentRequestEnvelope {
  type: AgentRequestType.HEARTBEAT;
  installation_id: string;
  seat_count: number;
  signature: string; // HMAC signature of the payload
  environment?: EnvironmentInfo; // Include environment updates in heartbeat
}

// Activation response
interface ActivationResponse {
  installation_id: string;
  installation_secret: string;
  license_jwt: string; // RSA-signed JWT containing license state
  heartbeat_interval_ms: number;
}

// Heartbeat response
interface HeartbeatResponse {
  license_jwt: string; // RSA-signed JWT containing license state
  heartbeat_interval_ms: number;
}

@Controller()
export class OnPremiseController {
  // Timestamp validation window (from shared constants)
  private readonly TIMESTAMP_WINDOW_MS = LICENSE_CONFIG.TIMESTAMP_WINDOW_MS;

  // Heartbeat intervals (from shared constants)
  private readonly HEARTBEAT_INTERVAL_NORMAL_MS =
    LICENSE_CONFIG.HEARTBEAT_INTERVAL_NORMAL_MS;
  private readonly HEARTBEAT_INTERVAL_FAILURE_MS =
    LICENSE_CONFIG.HEARTBEAT_INTERVAL_FAILURE_MS;

  constructor() {}

  @Post('/api/v1/on-premise/agent')
  @HttpCode(200)
  async handleAgentRequest(@Body() body: AgentRequestEnvelope) {
    // Validate request version
    if (body.version !== AgentRequestVersion.V1) {
      NcError._.badRequest(
        `Unsupported agent request version: ${body.version}`,
      );
    }

    // Validate timestamp to prevent replay attacks
    this.validateTimestamp(body.timestamp);

    switch (body.type) {
      case AgentRequestType.REGISTER:
        return this.handleActivation(body as ActivationRequest);
      case AgentRequestType.HEARTBEAT:
        return this.handleHeartbeat(body as HeartbeatRequest);
      case AgentRequestType.TELEMETRY:
        return this.handleTelemetry(body);
      default:
        NcError._.badRequest(`Unknown agent request type: ${body.type}`);
    }
  }

  /**
   * Handle activation request
   * - Validates license key
   * - Creates installation record with derived HMAC secret
   * - Returns installation credentials and initial JWT
   */
  private async handleActivation(
    body: ActivationRequest,
  ): Promise<ActivationResponse> {
    const ncMeta = Noco.ncMeta;

    // Validate license key format
    if (!body.license_key || typeof body.license_key !== 'string') {
      NcError._.badRequest('License key is required');
    }

    // Check if license key exists (either PENDING or already activated)
    const existingInstallation = await Installation.getByLicenseKey(
      body.license_key,
      ncMeta,
    );

    let installation: Installation;

    if (existingInstallation) {
      // If installation is PENDING, activate it
      if (existingInstallation.status === InstallationStatus.PENDING) {
        const clientSecret = await Installation.deriveClientSecret(
          existingInstallation.id,
          ncMeta,
        );
        // Activate the PENDING installation
        await Installation.update(
          existingInstallation.id,
          {
            installation_secret: clientSecret,
            status: InstallationStatus.ACTIVE,
            installed_at: new Date(),
            last_seen_at: new Date(),
            meta: {
              environment: body.environment,
            },
          },
          ncMeta,
        );

        // Get updated installation
        installation = await Installation.get(existingInstallation.id, ncMeta);
      } else {
        // Already activated
        NcError._.badRequest(
          'License key is already activated. Use heartbeat endpoint for updates.',
        );
      }
    } else {
      // See if old license key is valid
      const oldLicense = await this.verifyOldLicense(body.license_key);
      if (!oldLicense.valid) {
        NcError._.badRequest('Invalid license key');
      }

      installation = await Installation.insert(
        {
          license_key: body.license_key,
          licensed_to: oldLicense.data.siteUrl,
          license_type:
            oldLicense.data.type === 'ENTERPRISE'
              ? LicenseType.ENTERPRISE
              : LicenseType.ENTERPRISE_TRIAL,
          seat_count: 0,
          status: InstallationStatus.ACTIVE,
          installed_at: new Date(),
          last_seen_at: new Date(),
          meta: {
            environment: body.environment,
          },
          config: {
            ...(oldLicense.data.maxWorkspaces
              ? { limit_workspace: oldLicense.data.maxWorkspaces }
              : {}),
          },
        },
        ncMeta,
      );
    }

    // Generate RSA-signed JWT containing license state
    const licenseJWT = await Installation.signLicenseStateJWT(installation);

    return {
      installation_id: installation.id,
      installation_secret: installation.getClientSecret(),
      license_jwt: licenseJWT,
      heartbeat_interval_ms: this.HEARTBEAT_INTERVAL_NORMAL_MS,
    };
  }

  /**
   * Handle heartbeat request
   * - Verifies HMAC signature
   * - Updates seat count and last seen timestamp
   * - Returns updated license state and new JWT
   */
  private async handleHeartbeat(
    body: HeartbeatRequest,
  ): Promise<HeartbeatResponse> {
    const ncMeta = Noco.ncMeta;

    // Validate required fields
    if (!body.installation_id) {
      NcError._.badRequest('Installation ID is required');
    }
    if (body.seat_count === undefined || body.seat_count === null) {
      NcError._.badRequest('Seat count is required');
    }
    if (!body.signature) {
      NcError._.badRequest('Signature is required');
    }

    // Get installation
    const installation = await Installation.get(body.installation_id, ncMeta);
    if (!installation) {
      NcError._.badRequest('Installation not found');
    }

    // Verify HMAC signature
    const payloadToVerify = JSON.stringify({
      type: body.type,
      timestamp: body.timestamp,
      version: body.version,
      installation_id: body.installation_id,
      seat_count: body.seat_count,
      environment: body.environment,
    });

    if (!installation.verifyClientSignature(payloadToVerify, body.signature)) {
      NcError._.badRequest('Invalid signature');
    }

    // Check if installation is valid
    if (!installation.isValid()) {
      const licenseJWT = await Installation.signLicenseStateJWT(installation);

      return {
        license_jwt: licenseJWT,
        heartbeat_interval_ms: this.HEARTBEAT_INTERVAL_FAILURE_MS,
      };
    }

    // Update environment metadata if provided (including domains)
    if (body.environment) {
      await Installation.mergeMeta(
        body.installation_id,
        {
          environment: body.environment,
        },
        ncMeta,
      );
    }

    // Update seat count and heartbeat
    await Installation.recordHeartbeat(
      body.installation_id,
      body.seat_count,
      ncMeta,
    );

    // Refresh installation data after update
    const updatedInstallation = await Installation.get(
      body.installation_id,
      ncMeta,
    );

    // Generate RSA-signed JWT containing updated license state
    const licenseJWT = await Installation.signLicenseStateJWT(
      updatedInstallation,
    );

    return {
      license_jwt: licenseJWT,
      heartbeat_interval_ms: this.HEARTBEAT_INTERVAL_NORMAL_MS,
    };
  }

  /**
   * Handle telemetry request (placeholder for future implementation)
   */
  private async handleTelemetry(_body: AgentRequestEnvelope) {
    // TODO: Implement telemetry collection
    return { status: 'telemetry_received', timestamp: Date.now() };
  }

  /**
   * Validate timestamp to prevent replay attacks
   */
  private validateTimestamp(timestamp: number): void {
    const now = Date.now();
    const diff = Math.abs(now - timestamp);

    if (diff > this.TIMESTAMP_WINDOW_MS) {
      NcError._.badRequest(
        'Request timestamp is outside acceptable window (5 minutes)',
      );
    }
  }

  /**
   * Create a license in PENDING state
   * This allows pre-creating license keys for distribution to customers
   * The license will be activated when the customer first uses it
   */
  @UseGuards(AuthGuard('basic'))
  @Post('/api/internal/on-premise/license')
  @HttpCode(201)
  async createLicense(
    @Body()
    payload: {
      license_key: string;
      licensed_to: string;
      license_type: LicenseType;
      seat_count?: number;
      expires_at?: string;
      config?: {
        limit_workspace?: number;
      };
    },
  ) {
    const ncMeta = Noco.ncMeta;

    // Validate required fields
    if (!payload.license_key) {
      NcError._.badRequest('License key is required');
    }
    if (!payload.licensed_to) {
      NcError._.badRequest('Licensed to is required');
    }
    if (!payload.license_type) {
      NcError._.badRequest('License type is required');
    }

    // Check if license key already exists
    const existing = await Installation.getByLicenseKey(
      payload.license_key,
      ncMeta,
    );

    if (existing) {
      NcError._.badRequest('License key already exists');
    }

    // Create installation in PENDING state
    const installation = await Installation.insert(
      {
        license_key: payload.license_key,
        licensed_to: payload.licensed_to,
        license_type: payload.license_type,
        seat_count: payload.seat_count || 0,
        status: InstallationStatus.PENDING,
        expires_at: payload.expires_at
          ? new Date(payload.expires_at)
          : undefined,
        config: payload.config,
      },
      ncMeta,
    );

    return {
      id: installation.id,
      license_key: installation.license_key,
      licensed_to: installation.licensed_to,
      license_type: installation.license_type,
      status: installation.status,
      seat_count: installation.seat_count,
      expires_at: installation.expires_at,
      config: installation.config,
    };
  }

  /**
   * Update an existing license
   * Allows modifying license configuration, status, and other parameters
   */
  @UseGuards(AuthGuard('basic'))
  @Patch('/api/internal/on-premise/license')
  @HttpCode(200)
  async updateLicense(
    @Body()
    payload: Partial<Installation> & { id: string },
  ) {
    const ncMeta = Noco.ncMeta;

    if (!payload.id) {
      NcError._.badRequest('License ID is required');
    }

    // Validate at least one field to update is provided
    if (
      !payload.licensed_to &&
      !payload.license_type &&
      !payload.status &&
      payload.expires_at === undefined &&
      !payload.config
    ) {
      NcError._.badRequest('At least one field must be provided for update');
    }

    // Find installation by ID
    const installation = await Installation.get(payload.id, ncMeta);

    if (!installation) {
      NcError._.badRequest('License not found');
    }

    return await Installation.update(installation.id, payload, ncMeta);
  }

  private async verifyOldLicense(licenseKey: string) {
    if (!licenseKey) {
      return { valid: false, error: 'License key not found' };
    }
    try {
      const data: any = jwt.verify(licenseKey, LICENSE_SERVER_OLD_PUBLIC_KEY, {
        algorithms: ['RS256'],
      });

      // if any of the properties are missing, throw an error
      if (!data || !data.type || !data.siteUrl) {
        throw new Error('Invalid license key');
      }

      return { valid: true, data };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        const data = jwt.decode(licenseKey, { json: true });
        return { valid: true, data };
      }

      return { valid: false, error: 'Invalid license key' };
    }
  }
}
