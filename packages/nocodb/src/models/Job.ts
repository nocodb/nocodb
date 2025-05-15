import type { NcContext } from '~/interface/config';
import type { Condition } from '~/db/CustomKnex';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

export default class Job {
  id: string;
  job: string;
  status: string;
  result: string;
  fk_user_id: string;
  fk_workspace_id: string;
  base_id: string;
  created_at: Date;
  updated_at: Date;

  constructor(data: Partial<Job>) {
    Object.assign(this, data);
  }

  public static async insert(
    context: NcContext,
    jobObj: Partial<Job>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(jobObj, [
      'id',
      'job',
      'status',
      'result',
      'fk_user_id',
    ]);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.JOBS,
      insertObj,
    );

    return this.get(context, id, ncMeta);
  }

  public static async update(
    context: NcContext,
    jobId: string,
    jobObj: Partial<Job>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(jobObj, ['status', 'result']);

    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.JOBS,
      prepareForDb(updateObj, 'result'),
      jobId,
    );

    await NocoCache.update(
      `${CacheScope.JOBS}:${jobId}`,
      prepareForResponse(updateObj, 'result'),
    );

    return res;
  }

  public static async delete(
    context: NcContext,
    jobId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.JOBS,
      jobId,
    );

    await NocoCache.deepDel(
      `${CacheScope.JOBS}:${jobId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
  }

  public static async get(context: NcContext, id: any, ncMeta = Noco.ncMeta) {
    let jobData =
      id &&
      (await NocoCache.get(
        `${CacheScope.JOBS}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));

    if (!jobData) {
      jobData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.JOBS,
        id,
      );

      jobData = prepareForResponse(jobData, 'result');

      await NocoCache.set(`${CacheScope.JOBS}:${id}`, jobData);
    }

    return jobData && new Job(jobData);
  }

  public static async list(
    context: NcContext,
    opts: {
      condition?: Record<string, string>;
      xcCondition?: Condition;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Job[]> {
    const jobList = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.JOBS,
      opts,
    );

    return jobList.map((job) => {
      return new Job(prepareForResponse(job, 'result'));
    });
  }
}
