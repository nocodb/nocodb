import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import SSOClient from '~/models/SSOClient';

@Injectable()
export class SSOPassportMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    if (!req.params.clientId) return next();

    // get client by id
    const client = await SSOClient.get(req.params.clientId);

    if (!client || !client.enabled || client.deleted) {
      return res.status(400).json({
        msg: `Client not found`,
      });
    }

    if (!client.config) {
      return res.status(400).json({
        msg: `Client config not found`,
      });
    }

    if (client.type === 'oidc') {
    } else if (client.type === 'saml') {
    } else {
      return res.status(400).json({
        msg: `Client not supported`,
      });
    }
    next();
  }
}
