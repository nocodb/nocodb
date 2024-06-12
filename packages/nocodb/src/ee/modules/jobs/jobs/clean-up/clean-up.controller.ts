import { Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JobTypes } from '~/interface/Jobs';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
export class CleanUpController {
  constructor(@Inject('JobsService') private readonly jobsService) {}

  @Post('/internal/clean-up')
  @UseGuards(MetaApiLimiterGuard, AuthGuard('basic'))
  async resumeWorkers() {
    await this.jobsService.add(JobTypes.CleanUp);
  }
}
