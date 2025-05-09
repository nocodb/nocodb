import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import type { Request } from 'express';
import type { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';
import type { NcRequest } from '~/interface/config';
import { UsersService } from '~/services/users/users.service';
import { BaseUser, User } from '~/models';
import { sanitiseUserObj } from '~/utils';

/**
 * OpenID Connect strategy implementation
 * Uses passport-oauth2 for simplicity and compatibility with the existing auth flow
 */
@Injectable()
export class OidcStrategy extends PassportStrategy(Strategy, 'oidc') {
  constructor(private usersService: UsersService) {
    // Initialize with basic config, will be overridden in authenticate method
    super({
      authorizationURL: process.env.NC_OIDC_AUTHORIZATION_URL || 'https://example.com/oauth2/authorize',
      tokenURL: process.env.NC_OIDC_TOKEN_URL || 'https://example.com/oauth2/token',
      clientID: process.env.NC_OIDC_CLIENT_ID || 'dummy-id',
      clientSecret: process.env.NC_OIDC_CLIENT_SECRET || 'dummy-secret',
      callbackURL: 'http://localhost:8080/auth/oidc/callback',
      passReqToCallback: true,
      scope: ['openid', 'profile', 'email'],
      state: false,
    });
  }

  /**
   * Override authenticate method to load configuration from environment
   */
  authenticate(req: Request, options?: any): void {
    // Parse scopes from comma-separated env variable
    const scopes = process.env.NC_OIDC_SCOPES?.split(',').map(s => s.trim()) || ['openid', 'profile', 'email'];
    
    // Verify OIDC configuration exists
    if (
      !process.env.NC_OIDC_CLIENT_ID ||
      !process.env.NC_OIDC_CLIENT_SECRET ||
      !process.env.NC_OIDC_AUTHORIZATION_URL ||
      !process.env.NC_OIDC_TOKEN_URL
    ) {
      return this.fail({
        message:
          'OIDC configuration not found. Please define NC_OIDC_CLIENT_ID, NC_OIDC_CLIENT_SECRET, NC_OIDC_AUTHORIZATION_URL, and NC_OIDC_TOKEN_URL environment variables.',
      });
    }

    // Special handling for genTokenByCode with success code
    if (req.url.includes('/genTokenByCode') && req.query.code === 'success') {
      return;
    }

    // Default callback URL is site URL + /auth/oidc/callback 
    // Can be overridden with NC_OIDC_CALLBACK_URL
    const callbackURL = process.env.NC_OIDC_CALLBACK_URL || 
                       `${(req as any).ncSiteUrl}/auth/oidc/callback`;

    // Build options with provider-specific parameters
    const authOptions = {
      ...options,
      authorizationURL: process.env.NC_OIDC_AUTHORIZATION_URL,
      tokenURL: process.env.NC_OIDC_TOKEN_URL,
      clientID: process.env.NC_OIDC_CLIENT_ID,
      clientSecret: process.env.NC_OIDC_CLIENT_SECRET,
      callbackURL: callbackURL,
      scope: scopes,
      state: req.query.state,
      passReqToCallback: true,
    };

    // Add response_type if specified (required by some providers)
    if (process.env.NC_OIDC_RESPONSE_TYPE) {
      (authOptions as any).responseType = process.env.NC_OIDC_RESPONSE_TYPE;
    }
    
    return super.authenticate(req, authOptions);
  }

  /**
   * Validate the OAuth2 tokens and fetch user profile
   */
  async validate(
    req: NcRequest,
    accessToken: string,
    refreshToken: string,
    params: any,
    done: any
  ): Promise<any> {
    try {
      // Fetch user profile from the userinfo endpoint using the access token
      const userInfoURL = process.env.NC_OIDC_USERINFO_URL;
      if (!userInfoURL) {
        return done(new Error('Missing NC_OIDC_USERINFO_URL environment variable'), null);
      }

      const userInfoResponse = await axios.get(userInfoURL, { 
        headers: { Authorization: `Bearer ${accessToken}` } 
      });
      
      const userInfo = userInfoResponse.data;
      const email = userInfo.email;

      if (!email) {
        return done(new Error('Email not found in OIDC profile'), null);
      }

      // Check if user exists
      const user = await User.getByEmail(email);
      if (user) {
        // If baseId is defined, extract base level roles
        if (req.ncBaseId) {
          BaseUser.get(req.context, req.ncBaseId, user.id)
            .then(async (baseUser) => {
              user.roles = baseUser?.roles || user.roles;
              done(null, sanitiseUserObj(user));
            })
            .catch((e) => done(e));
        } else {
          return done(null, sanitiseUserObj(user));
        }
      } else {
        // Create new user if allowed
        const salt = await promisify(bcrypt.genSalt)(10);
        const user = await this.usersService.registerNewUserIfAllowed({
          email_verification_token: null,
          email: email,
          password: '',
          salt,
          req,
          display_name: userInfo.name || userInfo.preferred_username || email.split('@')[0],
        } as any);
        
        return done(null, sanitiseUserObj(user));
      }
    } catch (err) {
      return done(err);
    }
  }
}

export const OidcStrategyProvider: FactoryProvider = {
  provide: OidcStrategy,
  inject: [UsersService],
  useFactory: async (usersService: UsersService) => {
    return new OidcStrategy(usersService);
  },
};