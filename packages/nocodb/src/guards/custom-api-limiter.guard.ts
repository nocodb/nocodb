import {Injectable} from "@nestjs/common";
import {ThrottlerGuard} from "@nestjs/throttler";

@Injectable()
export class CustomApiLimiterGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): string {
    return req.headers['xc-auth'] as string;
  }
  generateKey(context, suffix) {
    return `throttler:${suffix}`;
  }
}
