import 'mocha';
import { expect } from 'chai';
import {
  JOB_REQUEUE_BASE_DELAY_MS,
  JOB_REQUEUE_LIMIT,
  JOB_REQUEUE_MAX_DELAY_MS,
  JobStatus,
  JobTypes,
  jobRequeueDelay,
  parseWorkerConcurrency,
} from '~/interface/Jobs';

// The JobsProcessor class transitively pulls in the full NocoDB job dependency
// graph (JobsMap → every job processor → noco.module). Loading it standalone
// trips a circular init. Inside the main test suite the graph is already
// resolved by the time these tests execute, so we lazy-import it in before().
let JobsProcessor: any;
let LOCAL_JOB_COUNT_MAP: Map<string, number>;

function makeJob(jobName: string, extra: Record<string, any> = {}): any {
  return {
    id: `test-${Math.random().toString(36).slice(2)}`,
    data: { jobName, ...extra },
    async releaseLock() {},
    async remove() {},
  };
}

function jobsProcessorTests() {
  describe('parseWorkerConcurrency', () => {
    it('defaults to 10 when env is undefined', () => {
      expect(parseWorkerConcurrency(undefined)).to.equal(10);
    });

    it('defaults to 10 when env is empty string', () => {
      expect(parseWorkerConcurrency('')).to.equal(10);
    });

    it('defaults to 10 when env is non-numeric', () => {
      expect(parseWorkerConcurrency('foo')).to.equal(10);
    });

    it('floors 0 to 1 (not silently upgrades to default)', () => {
      // Regression guard: previous `|| 10` short-circuit upgraded 0 → 10.
      expect(parseWorkerConcurrency('0')).to.equal(1);
    });

    it('floors negative to 1', () => {
      expect(parseWorkerConcurrency('-5')).to.equal(1);
    });

    it('truncates float to integer', () => {
      expect(parseWorkerConcurrency('5.7')).to.equal(5);
    });

    it('accepts trailing garbage', () => {
      expect(parseWorkerConcurrency('5foo')).to.equal(5);
    });

    it('passes through valid positive integers', () => {
      expect(parseWorkerConcurrency('5')).to.equal(5);
      expect(parseWorkerConcurrency('20')).to.equal(20);
      expect(parseWorkerConcurrency('1')).to.equal(1);
    });
  });

  describe('JobsProcessor', () => {
    before(() => {
      // Relative path: the `~/` TS alias is not resolved by runtime require().
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../../../src/modules/jobs/jobs.processor');
      JobsProcessor = mod.JobsProcessor;
      LOCAL_JOB_COUNT_MAP = mod.LOCAL_JOB_COUNT_MAP;
    });

    describe('jobRequeueDelay', () => {
      it('grows exponentially from the base delay', () => {
        expect(jobRequeueDelay(1)).to.equal(JOB_REQUEUE_BASE_DELAY_MS); // 5s
        expect(jobRequeueDelay(2)).to.equal(JOB_REQUEUE_BASE_DELAY_MS * 2); // 10s
        expect(jobRequeueDelay(3)).to.equal(JOB_REQUEUE_BASE_DELAY_MS * 4); // 20s
        expect(jobRequeueDelay(4)).to.equal(JOB_REQUEUE_BASE_DELAY_MS * 8); // 40s
      });

      it('caps at JOB_REQUEUE_MAX_DELAY_MS', () => {
        expect(jobRequeueDelay(5)).to.equal(JOB_REQUEUE_MAX_DELAY_MS);
        expect(jobRequeueDelay(20)).to.equal(JOB_REQUEUE_MAX_DELAY_MS);
        expect(jobRequeueDelay(JOB_REQUEUE_LIMIT)).to.equal(
          JOB_REQUEUE_MAX_DELAY_MS,
        );
      });

      it('floors attempt < 1 to base delay (no negative exponent)', () => {
        expect(jobRequeueDelay(0)).to.equal(JOB_REQUEUE_BASE_DELAY_MS);
        expect(jobRequeueDelay(-5)).to.equal(JOB_REQUEUE_BASE_DELAY_MS);
      });
    });

    describe('requeue()', () => {
      let addCalls: Array<{ name: string; data: any; opts: any }>;
      let onCompletedCalls: Array<{ jobId: string; status: JobStatus }>;
      let processor: any;

      beforeEach(() => {
        addCalls = [];
        onCompletedCalls = [];
        const mockJobsService: any = {
          async add(name: string, data: any, opts: any) {
            addCalls.push({ name, data: { ...data }, opts });
            return { id: opts?.jobId };
          },
        };
        const mockJobsEventService: any = {
          onCompleted(job: any, status: JobStatus) {
            onCompletedCalls.push({ jobId: job.id, status });
          },
        };
        const mockJobsMap: any = { jobs: {} };
        processor = new JobsProcessor(
          mockJobsService,
          mockJobsEventService,
          mockJobsMap,
        );
      });

      it('first attempt schedules with base delay', async () => {
        const job = makeJob(JobTypes.AtImport);
        await processor.requeue(job);
        expect(addCalls).to.have.length(1);
        expect(addCalls[0].opts.delay).to.equal(JOB_REQUEUE_BASE_DELAY_MS);
      });

      it('increments _jobAttempt', async () => {
        const job = makeJob(JobTypes.AtImport);
        await processor.requeue(job);
        expect(job.data._jobAttempt).to.equal(2);
        await processor.requeue(job);
        expect(job.data._jobAttempt).to.equal(3);
      });

      it('delay doubles each attempt until capped at max', async () => {
        const job = makeJob(JobTypes.MetaSync);
        const expected = [
          JOB_REQUEUE_BASE_DELAY_MS, // 5s
          JOB_REQUEUE_BASE_DELAY_MS * 2, // 10s
          JOB_REQUEUE_BASE_DELAY_MS * 4, // 20s
          JOB_REQUEUE_BASE_DELAY_MS * 8, // 40s
          JOB_REQUEUE_MAX_DELAY_MS, // 60s (cap)
          JOB_REQUEUE_MAX_DELAY_MS, // 60s
        ];
        for (let i = 0; i < expected.length; i++) {
          await processor.requeue(job);
          expect(addCalls[i].opts.delay).to.equal(expected[i]);
        }
      });

      it('drops job after JOB_REQUEUE_LIMIT attempts', async () => {
        const job = makeJob(JobTypes.MetaSync);
        for (let i = 0; i < JOB_REQUEUE_LIMIT; i++) {
          await processor.requeue(job);
        }
        expect(addCalls).to.have.length(JOB_REQUEUE_LIMIT);

        // The (limit+1)th call must drop the job without re-adding.
        await processor.requeue(job);
        expect(addCalls).to.have.length(JOB_REQUEUE_LIMIT);
      });

      it('emits REQUEUED event before re-adding', async () => {
        const job = makeJob(JobTypes.AtImport);
        await processor.requeue(job);
        expect(onCompletedCalls).to.have.length(1);
        expect(onCompletedCalls[0].status).to.equal(JobStatus.REQUEUED);
      });
    });

    describe('process() local concurrency bookkeeping', () => {
      let addCalls: Array<{ name: string; opts: any }>;
      let processor: any;
      let thumbnailFn: { job: (job: any) => Promise<any> };
      let metaSyncFn: { job: (job: any) => Promise<any> };

      beforeEach(() => {
        addCalls = [];
        LOCAL_JOB_COUNT_MAP.clear();
        thumbnailFn = { job: async () => 'done' };
        metaSyncFn = { job: async () => 'done' };
        const mockJobsService: any = {
          async add(name: string, _data: any, opts: any) {
            addCalls.push({ name, opts });
            return { id: opts?.jobId };
          },
        };
        const mockJobsEventService: any = { onCompleted() {} };
        const mockJobsMap: any = {
          jobs: {
            [JobTypes.ThumbnailGenerator]: { this: thumbnailFn },
            [JobTypes.MetaSync]: { this: metaSyncFn },
          },
        };
        processor = new JobsProcessor(
          mockJobsService,
          mockJobsEventService,
          mockJobsMap,
        );
      });

      it('configured-limit job: map = 1 while running, 0 after success', async () => {
        let observedDuringRun: number | undefined;
        thumbnailFn.job = async () => {
          observedDuringRun = LOCAL_JOB_COUNT_MAP.get(
            JobTypes.ThumbnailGenerator,
          );
          return 'ok';
        };
        await processor.process(makeJob(JobTypes.ThumbnailGenerator));
        expect(observedDuringRun).to.equal(1);
        expect(LOCAL_JOB_COUNT_MAP.get(JobTypes.ThumbnailGenerator)).to.equal(
          0,
        );
      });

      it('configured-limit job: decrements on throw', async () => {
        thumbnailFn.job = async () => {
          throw new Error('boom');
        };
        try {
          await processor.process(makeJob(JobTypes.ThumbnailGenerator));
        } catch {
          // expected
        }
        expect(LOCAL_JOB_COUNT_MAP.get(JobTypes.ThumbnailGenerator)).to.equal(
          0,
        );
      });

      it('unconfigured-limit job: never writes to map', async () => {
        await processor.process(makeJob(JobTypes.MetaSync));
        expect(LOCAL_JOB_COUNT_MAP.has(JobTypes.MetaSync)).to.equal(false);
      });

      it('cap hit: requeues with base delay, does not change map', async () => {
        LOCAL_JOB_COUNT_MAP.set(JobTypes.ThumbnailGenerator, 1);
        await processor.process(makeJob(JobTypes.ThumbnailGenerator));
        expect(LOCAL_JOB_COUNT_MAP.get(JobTypes.ThumbnailGenerator)).to.equal(
          1,
        );
        expect(addCalls).to.have.length(1);
        expect(addCalls[0].opts.delay).to.equal(JOB_REQUEUE_BASE_DELAY_MS);
      });

      it('multi-cycle: map stays at 0 between successive runs', async () => {
        for (let i = 0; i < 5; i++) {
          await processor.process(makeJob(JobTypes.ThumbnailGenerator));
          expect(LOCAL_JOB_COUNT_MAP.get(JobTypes.ThumbnailGenerator)).to.equal(
            0,
          );
        }
      });
    });
  });
}

export function jobsProcessorTest() {
  describe('JobsProcessor', jobsProcessorTests);
}
