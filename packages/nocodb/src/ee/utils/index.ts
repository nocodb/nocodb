import canUseOptimisedQuery from '~/utils/canUseOptimisedQuery';
export * from 'src/utils';
export * from './getWorkspaceUrl';
export * from './domainVerification';
export { canUseOptimisedQuery };

export const isEE: boolean = true;
export const isOnPrem: boolean = false;
export const isCloud: boolean = false;
export const isDevOrTestEnvironment: boolean =
  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
