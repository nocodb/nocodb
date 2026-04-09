import { Injectable } from '@nestjs/common';
import { UseWorkerProcessor as UseWorkerProcessorCE } from 'src/modules/jobs/jobs/use-worker/use-worker.processor';
import { TablesService } from '~/services/tables.service';
import { AttachmentsService } from '~/services/attachments.service';
import { AiSchemaService } from '~/integrations/ai/module/services/ai-schema.service';

@Injectable()
export class UseWorkerProcessor extends UseWorkerProcessorCE {
  constructor(
    protected readonly attachmentsService: AttachmentsService,
    protected readonly tablesService: TablesService,
    protected readonly aiSchemaService: AiSchemaService,
  ) {
    super(attachmentsService, tablesService);
  }

  protected get serviceMap(): Record<string, any> {
    return {
      ...super.serviceMap,
      [AiSchemaService.name]: this.aiSchemaService,
    };
  }
}
