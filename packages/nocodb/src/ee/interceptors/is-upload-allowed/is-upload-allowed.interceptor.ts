import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class UploadAllowedInterceptor implements NestInterceptor {
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    if (!request['user']?.id) {
      if (!request['user']?.isPublicBase) {
        NcError.unauthorized('Unauthorized');
      }
    }

    return next.handle();
  }
}
