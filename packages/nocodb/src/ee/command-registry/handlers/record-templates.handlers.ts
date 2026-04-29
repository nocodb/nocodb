import { registerForward } from '~/command-registry/_replay-context';
import {
  RecordTemplateCreateContract,
  RecordTemplateUpdateContract,
  RecordTemplateDeleteContract,
} from '../operations/record-templates.operations';
import type { RecordTemplatesService } from 'src/ee/services/record-templates/record-templates.service';

export function registerRecordTemplateHandlers(
  svc: RecordTemplatesService,
): void {
  registerForward(RecordTemplateCreateContract, (ctx, p) => svc.recordTemplateCreate(ctx, p));
  registerForward(RecordTemplateUpdateContract, (ctx, p) => svc.recordTemplateUpdate(ctx, p));
  registerForward(RecordTemplateDeleteContract, (ctx, p) => svc.recordTemplateDelete(ctx, p));
}
