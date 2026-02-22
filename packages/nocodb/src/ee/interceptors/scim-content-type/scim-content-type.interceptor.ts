import { Injectable } from '@nestjs/common';
import { tap } from 'rxjs/operators';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';

/**
 * Sets Content-Type to application/scim+json on all SCIM responses
 * as required by RFC 7644 §3.1.
 */
@Injectable()
export class ScimContentTypeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        response.header('Content-Type', 'application/scim+json; charset=utf-8');
      }),
    );
  }
}
