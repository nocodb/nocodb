import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Phase 1 shares the Basic credential with DeployHookGuard; on Cloud the WAF keeps /api/internal on the tailnet.
@Injectable()
export class OperatorGuard extends AuthGuard('basic') {}
