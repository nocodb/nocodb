import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Its own class so the deploy credential can split from the operator one without touching routes.
@Injectable()
export class DeployHookGuard extends AuthGuard('basic') {}
