import request from 'supertest';

/**
 * Polls for job completion
 *
 * @param options
 * @returns Job result data
 */
export const listenForJob = async (options: {
  context: any;
  base_id: string;
  job_id: string;
  max_attempts?: number;
}) => {
  const { context, base_id, job_id, max_attempts = 20 } = options;

  let jobCompleted = false;
  let resultData: any = null;
  let mid = 0;
  let attempts = 0;

  while (!jobCompleted && attempts < max_attempts) {
    attempts++;

    // Poll using the jobs/listen endpoint
    const jobStatusResponse = await request(context.app)
      .post(`/jobs/listen`)
      .set('xc-auth', context.token)
      .send({ _mid: mid, data: { id: job_id } })
      .expect(200);

    // If response is an array, process each message
    const responses = Array.isArray(jobStatusResponse.body)
      ? jobStatusResponse.body
      : [jobStatusResponse.body];

    for (const response of responses) {
      // Update mid for next polling request
      if (response._mid > mid) {
        mid = response._mid;
      }

      if (response.status === 'update') {
        const data = response.data;
        if (data.status === 'completed') {
          jobCompleted = true;
          resultData = data.data.result;
          break;
        } else if (data.status === 'failed') {
          throw new Error(
            `Job failed: ${data.data?.error?.message || 'Unknown error'}`,
          );
        }
      } else if (response.status === 'close') {
        // The job was already completed before we started polling
        // Try to get the job result directly
        const jobsResponse = await request(context.app)
          .post(`/api/v2/jobs/${base_id}`)
          .set('xc-auth', context.token)
          .send({})
          .expect(200);

        const completedJob = jobsResponse.body.find((job) => job.id === job_id);
        if (completedJob) {
          jobCompleted = true;
          resultData = completedJob.result;
        } else {
          throw new Error('Job closed but no result found');
        }
        break;
      }
    }
  }

  if (!jobCompleted || !resultData) {
    throw new Error(
      `Job did not complete after ${max_attempts} polling attempts`,
    );
  }

  return resultData;
};
