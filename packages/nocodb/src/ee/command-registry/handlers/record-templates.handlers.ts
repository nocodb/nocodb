import { OperationRegistry } from '~/command-registry/_registry';
import { makeReplayReq } from '~/command-registry/_replay-context';
import {
  RecordTemplateCreateContract,
  RecordTemplateUpdateContract,
  RecordTemplateDeleteContract,
} from '../operations/record-templates.operations';
import type { RecordTemplatesService } from 'src/ee/services/record-templates/record-templates.service';

export function registerRecordTemplateHandlers(
  svc: RecordTemplatesService,
): void {
  OperationRegistry.register(
    RecordTemplateCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.recordTemplateCreate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    RecordTemplateUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.recordTemplateUpdate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    RecordTemplateDeleteContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.recordTemplateDelete(ctx, { ...params, req } as any);
    },
  );
}
