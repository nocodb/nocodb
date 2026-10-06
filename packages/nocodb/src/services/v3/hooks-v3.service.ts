import { Injectable } from '@nestjs/common';
import { parseProp } from 'nocodb-sdk';
import type {
  HookNotificationV3V3Type,
  HookReqType,
  HookV3CreateV3Type,
  HookV3UpdateV3Type,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { Hook } from '~/models';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { HooksService } from '~/services/hooks.service';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';

// Internal event → user-facing event
const eventToV3: Record<string, string> = {
  after: 'record',
};

// User-facing event → internal event
const eventFromV3: Record<string, string> = {
  record: 'after',
};

@Injectable()
export class HooksV3Service {
  // Response builder: transforms internal Hook model to V3 API response format
  protected builder = builderGenerator<Hook>({
    allowed: [
      'id',
      'fk_model_id',
      'title',
      'description',
      'event',
      'operation',
      'notification',
      'active',
      'trigger_fields',
      'created_at',
      'updated_at',
    ],
    mappings: {
      fk_model_id: 'table_id',
    },
    meta: {
      snakeCase: true,
      metaProps: ['notification'],
    },
    transformFn: (data) => {
      data.event = eventToV3[data.event] ?? data.event;
      return data;
    },
  });

  // Request builder: transforms V3 API request format to internal Hook model format
  protected requestBuilder = builderGenerator<
    HookV3CreateV3Type | HookV3UpdateV3Type
  >({
    allowed: [
      'title',
      'description',
      'event',
      'operation',
      'notification',
      'active',
      'trigger_fields',
      'table_id',
    ],
    mappings: {
      table_id: 'fk_model_id',
    },
    meta: {
      snakeCase: true,
      metaProps: ['notification'],
    },
    transformFn: (data) => {
      data.event = eventFromV3[data.event] ?? data.event ?? 'after';
      data.version = 'v3';

      // Dispatch (`Hook.list`) only honours `trigger_fields` when the singular
      // `trigger_field` boolean is set — and nothing else supplies it, so v3/MCP
      // hooks were persisted with scoping that never took effect. Derive the
      // boolean from the array so the hook fires only on the listed columns.
      if (Array.isArray(data.trigger_fields)) {
        data.trigger_field = data.trigger_fields.length > 0;
      }
      return data;
    },
  });

  constructor(protected readonly hooksService: HooksService) {}

  // Column scoping only fires for a record-event `update`: the dispatch filter
  // consults `trigger_fields` only under that operation, and a `manual` hook is
  // filtered out by event before reaching it. Reject the inert combinations
  // instead of silently persisting scoping that can never fire.
  //
  // Callers must pass the *effective* hook (body merged over the stored row),
  // not the raw body — an update that omits `event`/`operation` still inherits
  // them, and the guard would otherwise pass vacuously.
  protected assertTriggerFieldsScope(
    context: NcContext,
    hook: { event?: string; operation?: string[]; trigger_fields?: string[] },
  ) {
    if (!hook.trigger_fields?.length) return;

    // 'manual' is spelled the same internally and in v3, so this holds for a
    // stored event as well as a request one.
    if (hook.event === 'manual') {
      NcError.get(context).invalidRequestBody(
        'trigger_fields is not supported for a "manual" webhook — it fires on an explicit trigger, never on a column edit',
      );
    }

    if (Array.isArray(hook.operation) && !hook.operation.includes('update')) {
      NcError.get(context).invalidRequestBody(
        'trigger_fields is only supported when the operation includes "update"',
      );
    }
  }

  // PATCH is a partial update — `HookV3Update` requires nothing, and the
  // documented examples send `{title}` or `{active}` alone. The body reaches
  // `HooksService.hookUpdate`, which revalidates it against the v1 `HookReq`
  // (title/event/operation/notification all required) and 400s, and
  // `requestBuilder` defaults an absent `event` to `after` — converting a
  // `manual` hook into a record one and detaching every button column bound to
  // it. Merge the body over the stored hook so an omitted property keeps its
  // stored value; `Hook.update` likewise rewrites the trigger-field rows on
  // every v3 write, so `trigger_fields` has to be carried too.
  protected mergeOverStored(
    existing: Hook,
    patch: HookV3UpdateV3Type,
  ): HookV3UpdateV3Type {
    const stored: HookV3UpdateV3Type = {
      title: existing.title,
      description: existing.description,
      // `manual` is spelled the same on both sides, and an internal event with
      // no v3 spelling (a comment hook) is carried through untouched rather
      // than rewritten.
      event: (eventToV3[existing.event] ??
        existing.event) as HookV3UpdateV3Type['event'],
      operation: existing.operation as HookV3UpdateV3Type['operation'],
      notification: parseProp(
        existing.notification,
      ) as HookNotificationV3V3Type,
      active: !!existing.active,
      trigger_fields: existing.trigger_fields ?? [],
    };

    // Presence, not truthiness: a key the caller omits keeps its stored value,
    // a key sent explicitly — `[]`, `false`, `null` — overrides it.
    return {
      ...stored,
      ...Object.fromEntries(
        Object.entries(patch ?? {}).filter(([, value]) => value !== undefined),
      ),
    };
  }

  async hookList(context: NcContext, param: { tableId: string }) {
    const list = await Hook.list(context, { fk_model_id: param.tableId });

    return this.builder().build(list);
  }

  async hookGet(context: NcContext, param: { hookId: string }) {
    const hook = await Hook.get(context, param.hookId);

    return this.builder().build(hook);
  }

  async hookCreate(
    context: NcContext,
    param: {
      tableId: string;
      hook: HookV3CreateV3Type;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/HookV3Create',
      param.hook,
      true,
    );

    this.assertTriggerFieldsScope(context, param.hook);

    // Transform V3 request to internal format
    const hookData = this.requestBuilder().build(param.hook);

    const hook = await this.hooksService.hookCreate(context, {
      tableId: param.tableId,
      hook: hookData as HookReqType,
      req: param.req,
    });

    return this.builder().build(hook);
  }

  async hookUpdate(
    context: NcContext,
    param: {
      hookId: string;
      hook: HookV3UpdateV3Type;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/HookV3Update',
      param.hook,
      true,
    );

    const existing = await Hook.get(context, param.hookId);

    if (!existing) {
      NcError.get(context).hookNotFound(param.hookId);
    }

    const body = this.mergeOverStored(existing, param.hook);

    this.assertTriggerFieldsScope(context, body);

    // Transform V3 request to internal format
    const hookData = this.requestBuilder().build(body);

    const hook = await this.hooksService.hookUpdate(context, {
      hookId: param.hookId,
      hook: hookData as HookReqType,
      req: param.req,
    });

    return this.builder().build(hook);
  }

  async hookDelete(
    context: NcContext,
    param: { hookId: string; req: NcRequest },
  ) {
    return await this.hooksService.hookDelete(context, param);
  }
}
