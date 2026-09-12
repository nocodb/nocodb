/**
 * @nocodb/app-ctx/react — platform-owned data hooks for NocoDB apps.
 *
 * Compiled at image-build (esbuild, react/@tanstack/react-query/sonner
 * external) into the package copied into every app's node_modules — see the
 * Dockerfile. Generated pages consume actions ONLY through these hooks (the
 * template CLAUDE.md contract): reads via useActionQuery, writes via
 * useActionMutation. Freshness is platform-owned: a successful mutation
 * invalidates EVERY action query by default (narrow with opts.invalidates),
 * so a list can never render stale data after a write.
 */
import { createElement, useState, type ReactNode } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { ctx, IntegrationError } from './index';

export const ROUTINE_QUERY_PREFIX = 'nc-routine';

/** Key-stable stringify: object keys sorted recursively so `{a,b}` === `{b,a}`. */
function stableKey(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(stableKey).join(',')}]`;
  return `{${Object.keys(v as Record<string, unknown>)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableKey((v as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}

export interface RoutineQueryOptions {
  /** Gate the query (e.g. wait for a selected record id). Default true. */
  enabled?: boolean;
}

/** Read data through an action. Cached + deduped; refetches after any mutation. */
export function useActionQuery<T = unknown>(
  name: string,
  params?: unknown,
  options?: RoutineQueryOptions,
) {
  return useQuery<T>({
    queryKey: [ROUTINE_QUERY_PREFIX, name, stableKey(params)],
    queryFn: () => ctx.actions[name](params) as Promise<T>,
    enabled: options?.enabled ?? true,
  });
}

export interface RoutineMutationOptions {
  /**
   * Action names whose queries should refetch after success. Default:
   * EVERY action query refetches (blunt but always fresh).
   */
  invalidates?: string[];
  /** Suppress the built-in error toast (render the error inline instead). */
  silent?: boolean;
}

/** Write data through an action. On success, affected queries refetch automatically. */
export function useActionMutation<T = unknown, P = unknown>(
  name: string,
  options?: RoutineMutationOptions,
) {
  const queryClient = useQueryClient();
  return useMutation<T, Error, P>({
    mutationFn: (params: P) => ctx.actions[name](params) as Promise<T>,
    onSuccess: async () => {
      if (options?.invalidates?.length) {
        await Promise.all(
          options.invalidates.map((routine) =>
            queryClient.invalidateQueries({
              queryKey: [ROUTINE_QUERY_PREFIX, routine],
            }),
          ),
        );
        return;
      }
      await queryClient.invalidateQueries({ queryKey: [ROUTINE_QUERY_PREFIX] });
    },
    onError: (e: Error) => {
      if (options?.silent) return;
      toast.error(
        e instanceof IntegrationError
          ? e.message
          : 'Something went wrong. Please try again.',
      );
    },
  });
}

/** Mounted by the platform-owned App.tsx — generated code never wires this. */
export function AppDataProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 0 },
        },
      }),
  );
  return createElement(QueryClientProvider, { client }, children);
}
