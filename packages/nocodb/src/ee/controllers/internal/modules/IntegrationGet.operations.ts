import { Injectable } from '@nestjs/common';
import { IntegrationGetOperations as IntegrationGetOperationsCE } from 'src/controllers/internal/modules/IntegrationGet.operations';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { BaseIntegrationsService } from '~/services/base-integrations.service';

@Injectable()
export class IntegrationGetOperations
  extends IntegrationGetOperationsCE
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(
    protected readonly baseIntegrationsService: BaseIntegrationsService,
  ) {
    super(baseIntegrationsService);
  }
}
