import { CacheScope } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';

/**
 * We have to clear cache if any user is deleted or user role is changed
 * @param workspaceId workspace id
 */
export const clearWorkspaceUserCountCache = async (workspaceId: string) => {
  const keys = [
    `${CacheScope.WORKSPACE}:${workspaceId}:userCount:true:true`,
    `${CacheScope.WORKSPACE}:${workspaceId}:userCount:true:false`,
    `${CacheScope.WORKSPACE}:${workspaceId}:userCount:false:true`,
    `${CacheScope.WORKSPACE}:${workspaceId}:userCount:false:false`,
  ];
  await NocoCache.del('root', keys);
};
