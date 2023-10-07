import { CacheGetType, CacheScope } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { Base } from '~/models';

export default async (baseId: string) => {
  let wsId = await NocoCache.get(
    `${CacheScope.BASE_TO_WORKSPACE}:${baseId}`,
    CacheGetType.TYPE_STRING,
  );

  if (!wsId) {
    const base = await Base.get(baseId);
    if (base) {
      wsId = (base as any).fk_workspace_id;
      await NocoCache.set(`${CacheScope.BASE_TO_WORKSPACE}:${baseId}`, wsId);
    }
  }

  return wsId;
};
