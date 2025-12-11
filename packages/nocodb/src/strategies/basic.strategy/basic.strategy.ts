import crypto from 'crypto';
import { BasicStrategy as Strategy } from 'passport-http';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '~/interface/config';

@Injectable()
export class BasicStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(BasicStrategy.name);

  constructor(private readonly configService: ConfigService<AppConfig>) {
    super({
      passReqToCallback: true,
    });
  }

  public validate = async (req, username, password): Promise<boolean> => {
    const credentials = this.configService.get('basicAuth', {
      infer: true,
    });

    // Security check: prevent use of uninitialized credentials
    if (
      credentials.username === '__UNINITIALIZED__' ||
      credentials.password === '__UNINITIALIZED__'
    ) {
      this.logger.error(
        'HTTP Basic Auth credentials not initialized. This should never happen.',
      );
      throw new UnauthorizedException();
    }

    // Constant-time comparison to prevent timing attacks
    const usernameMatch = this.secureCompare(credentials.username, username);
    const passwordMatch = this.secureCompare(credentials.password, password);

    if (usernameMatch && passwordMatch) {
      return true;
    }

    // Log failed authentication attempts (for security monitoring)
    this.logger.warn(
      `HTTP Basic Auth failed for user: ${username} from IP: ${req.ip}`,
    );

    throw new UnauthorizedException();
  };

  /**
   * Constant-time string comparison to prevent timing attacks
   * Uses crypto.timingSafeEqual for security-critical comparison
   */
  private secureCompare(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }

    // Convert to buffers for timing-safe comparison
    const bufferA = Buffer.from(a, 'utf8');
    const bufferB = Buffer.from(b, 'utf8');

    // If lengths differ, still perform comparison to prevent timing leak
    if (bufferA.length !== bufferB.length) {
      // Compare against self to maintain constant time
      crypto.timingSafeEqual(bufferA, bufferA);
      return false;
    }

    try {
      return crypto.timingSafeEqual(bufferA, bufferB);
    } catch {
      return false;
    }
  }
}
