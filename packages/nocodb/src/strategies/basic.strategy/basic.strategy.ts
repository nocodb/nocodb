import { timingSafeEqual } from 'crypto';
import { BasicStrategy as Strategy } from 'passport-http';
import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '~/interface/config';
import { NcError } from '~/helpers/ncError';

/**
 * Constant-time string comparison. Guards the length first (unequal lengths
 * short-circuit) and compares equal-length buffers with `timingSafeEqual` to
 * avoid leaking the credential via response timing.
 */
function safeEqual(a: string | undefined, b: string | undefined): boolean {
  const bufA = Buffer.from(String(a ?? ''));
  const bufB = Buffer.from(String(b ?? ''));

  if (bufA.length !== bufB.length) return false;

  return timingSafeEqual(bufA, bufB);
}

@Injectable()
export class BasicStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(BasicStrategy.name);

  // Log the misconfiguration once per process rather than on every request.
  private unconfiguredWarningLogged = false;

  constructor(private readonly configService: ConfigService<AppConfig>) {
    super({
      passReqToCallback: true,
    });
  }

  public validate = async (req, username, password): Promise<boolean> => {
    const credentials = this.configService.get('basicAuth', {
      infer: true,
    });

    // Fail closed: if the internal-service credentials have not been explicitly
    // configured (NC_HTTP_BASIC_USER / NC_HTTP_BASIC_PASS), reject every request
    // instead of falling back to well-known default credentials.
    if (!credentials?.username || !credentials?.password) {
      // Without this the failure is an indistinguishable 401 — an operator
      // upgrading from a build that had baked-in defaults would see internal
      // endpoints (payment, worker, clean-up cron) start failing with no clue why.
      if (!this.unconfiguredWarningLogged) {
        this.unconfiguredWarningLogged = true;
        this.logger.error(
          'Basic auth is not configured — rejecting all internal-endpoint requests. ' +
            'Set NC_HTTP_BASIC_USER and NC_HTTP_BASIC_PASS to enable them.',
        );
      }

      NcError.unauthorized('UnAuthorized');
    }

    if (
      safeEqual(credentials.username, username) &&
      safeEqual(credentials.password, password)
    ) {
      return true;
    }

    NcError.unauthorized('UnAuthorized');
  };
}
