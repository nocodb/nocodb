import { ConfigService } from '@nestjs/config';
import { ExecutionTimeCalculatorInterceptor } from './execution-time-calculator.interceptor';
import type { AppConfig } from '../../interface/config';

describe('ExecutionTimeCalculatorInterceptor', () => {
  it('should be defined', () => {
    expect(
      new ExecutionTimeCalculatorInterceptor(
        new ConfigService<AppConfig>({
          throttler: {
            ttl: 60,
            max_apis: 600,
            calc_execution_time: true,
          },
        }),
      ),
    ).toBeDefined();
  });
});
