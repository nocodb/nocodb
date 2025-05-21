import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import type { NcContext, NcRequest } from '~/interface/config';
import type { JobTypes } from '~/interface/Jobs';
import { JobStatus } from '~/interface/Jobs';
import { Job } from '~/models';
import Noco from '~/Noco';

@Injectable()
export class JobsMetaService {
  constructor() {}

  async list(
    context: NcContext,
    param: { job?: JobTypes; status?: JobStatus },
    req: NcRequest,
  ) {
    /*
     * List jobs for the current base.
     * If the job is not created by the current user, exclude the result.
     * List jobs updated in the last 1 hour or jobs that are still active(, waiting, or delayed).
     */
    return Job.list(context, {
      xcCondition: {
        _and: [
          ...(param.job
            ? [
                {
                  job: {
                    eq: param.job,
                  },
                },
              ]
            : []),
          ...(param.status
            ? [
                {
                  status: {
                    eq: param.status,
                  },
                },
              ]
            : []),
          {
            _or: [
              {
                updated_at: {
                  gt: Noco.ncMeta.formatDateTime(
                    dayjs().subtract(1, 'hour').toISOString(),
                  ),
                },
              },
              {
                status: {
                  eq: JobStatus.ACTIVE,
                },
              },
              {
                status: {
                  eq: JobStatus.WAITING,
                },
              },
              {
                status: {
                  eq: JobStatus.DELAYED,
                },
              },
            ],
          },
        ],
      },
    }).then((jobs) => {
      return jobs.map((job) => {
        if (job.fk_user_id === req.user.id) {
          return job;
        } else {
          const { result, ...rest } = job;
          return rest;
        }
      });
    });
  }
}
