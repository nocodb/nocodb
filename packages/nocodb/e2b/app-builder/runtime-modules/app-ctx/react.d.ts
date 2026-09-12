import type { ReactElement, ReactNode } from 'react';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';

export declare const ROUTINE_QUERY_PREFIX: string;

export interface RoutineQueryOptions {
  enabled?: boolean;
}
export declare function useActionQuery<T = unknown>(
  name: string,
  params?: unknown,
  options?: RoutineQueryOptions,
): UseQueryResult<T>;

export interface RoutineMutationOptions {
  invalidates?: string[];
  silent?: boolean;
}
export declare function useActionMutation<T = unknown, P = unknown>(
  name: string,
  options?: RoutineMutationOptions,
): UseMutationResult<T, Error, P>;

export declare function AppDataProvider(props: {
  children: ReactNode;
}): ReactElement;
