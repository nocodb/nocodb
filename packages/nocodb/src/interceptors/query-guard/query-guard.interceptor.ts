import { Injectable } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { SEARCH_STATE_FIELD } from 'nocodb-sdk';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Subscription } from 'rxjs';
import type { QueryGuard } from '~/db/queryGuard';
import { QueryAbortedError, runWithQueryGuard } from '~/db/queryGuard';
import { hasSearchTerm } from '~/db/search';
import { NcError } from '~/helpers/catchError';
import { KeyedSemaphore } from '~/helpers/keyedSemaphore';
import {
  NC_SEARCH_MAX_CONCURRENT,
  NC_SEARCH_QUEUE_WAIT_MS,
  NC_SEARCH_STATEMENT_TIMEOUT_MS,
} from '~/utils/nc-config';

// POST endpoints that only read: batched list / aggregate requests.
const READ_POST_OPERATIONS = new Set(['bulkDataList', 'bulkAggregate']);
const READ_POST_PATH = /\/(bulk\/(dataList|aggregate)|summary)$/;

// Internal operations whose `search` is the all-fields search; other operations use the name for their own lookups.
const SEARCH_OPERATIONS = new Set([
  'dataList',
  'dataAggregate',
  'bulkDataList',
  'bulkAggregate',
  'baseRecordSearch',
]);

// Shared view data routes; the v1/v2 data APIs and other public routes keep ignoring `search`.
const SHARED_VIEW_SEARCH_PATH =
  /\/shared-view\/:sharedViewUuid\/(rows|count|aggregate|groupby(\/count)?|group\/:columnId|bulk\/(dataList|aggregate))$/;

const INTERNAL_PATH = /^\/api\/v2\/internal\//;

const searchSlots = new KeyedSemaphore(NC_SEARCH_MAX_CONCURRENT);

/** Aborts once the response closes before it was fully written: the client left. */
export function responseAbortSignal(res: Response): AbortSignal {
  const controller = new AbortController();
  res.once('close', () => {
    if (!res.writableFinished) controller.abort();
  });
  return controller.signal;
}

function isReadRequest(req: Request) {
  if (req.method === 'GET') return true;
  if (req.method !== 'POST') return false;
  return (
    READ_POST_OPERATIONS.has(req.query?.operation as string) ||
    READ_POST_PATH.test(req.route?.path ?? '')
  );
}

// `operation` is the caller's to set, so only the internal API reads it; elsewhere the route decides.
function isSearchRoute(req: Request) {
  const path: string = req.route?.path ?? '';
  if (INTERNAL_PATH.test(path))
    return SEARCH_OPERATIONS.has(req.query?.operation as string);
  return SHARED_VIEW_SEARCH_PATH.test(path);
}

export function isSearchRequest(req: Request) {
  if (!isReadRequest(req) || !isSearchRoute(req)) return false;
  return (
    hasSearchTerm(req.query) ||
    (Array.isArray(req.body) && req.body.some((entry) => hasSearchTerm(entry)))
  );
}

type Paged = { pageInfo?: Record<string, unknown> };
const isPaged = (value: unknown): value is Paged =>
  !!value &&
  typeof value === 'object' &&
  !!(value as Paged).pageInfo &&
  typeof (value as Paged).pageInfo === 'object';

/**
 * The search's state in each page's `pageInfo`: a list, or a batch of lists
 * keyed by alias.
 */
function withSearchState(body: unknown, guard: QueryGuard) {
  const state = guard.searchState;
  if (!state || !body || typeof body !== 'object') return body;
  const pages = isPaged(body) ? [body] : Object.values(body).filter(isPaged);
  for (const page of pages) page.pageInfo[SEARCH_STATE_FIELD] = state;
  return body;
}

/**
 * Searches share slots per base; a route without one falls back to its table
 * or shared view, a workspace-wide search to its workspace.
 */
function searchSlotKey(req: Request) {
  const r = req as Request & { ncBaseId?: string };
  const params = req.params ?? {};
  const baseId =
    r.ncBaseId ?? (params.baseId !== 'nc' ? params.baseId : undefined);
  return (
    baseId ??
    params.modelId ??
    params.tableId ??
    params.tableName ??
    params.sharedViewUuid ??
    (req.query?.tableId as string) ??
    (params.workspaceId ? `ws:${params.workspaceId}` : undefined) ??
    ''
  );
}

/**
 * Limits on an all-fields search: cancelled when the client disconnects, a
 * statement timeout, and a per-base cap on concurrent search requests. Every
 * other request passes through untouched.
 */
@Injectable()
export class QueryGuardInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    if (!isSearchRequest(req)) return next.handle();

    const res = context.switchToHttp().getResponse<Response>();
    const signal = responseAbortSignal(res);
    const guard: QueryGuard = {
      signal,
      search: true,
      planSettings: req.query?.operation !== 'baseRecordSearch',
      statementTimeoutMs: NC_SEARCH_STATEMENT_TIMEOUT_MS,
      timeoutMessage:
        'Search took too long. Try a more specific term or fewer fields.',
    };

    return new Observable((subscriber) => {
      let release: (() => void) | null = null;
      let subscription: Subscription | undefined;
      let closed = false;

      searchSlots
        .acquire(searchSlotKey(req), NC_SEARCH_QUEUE_WAIT_MS, signal)
        .then((granted) => {
          if (closed) return granted?.();
          if (signal.aborted) throw new QueryAbortedError();
          if (!granted) {
            NcError.get().tooManyRequests(
              'Too many searches are running on this base. Try again in a moment.',
            );
          }
          release = granted;
          // handle() binds the async context it is called in, so call it inside the scope.
          subscription = runWithQueryGuard(guard, () =>
            next
              .handle()
              .pipe(map((body) => withSearchState(body, guard)))
              .subscribe(subscriber),
          );
        })
        .catch((e) => subscriber.error(e));

      return () => {
        closed = true;
        subscription?.unsubscribe();
        release?.();
      };
    });
  }
}
