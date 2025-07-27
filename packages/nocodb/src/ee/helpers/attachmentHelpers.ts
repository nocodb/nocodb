import { PlanLimitTypes } from 'nocodb-sdk';
import { getLimit } from './paymentHelpers';
import type { NcContext } from 'nocodb-sdk';
import type { Column } from '~/models';
import { NcError } from '~/helpers/ncError';

export * from 'src/helpers/attachmentHelpers';

export const validateNumberOfFilesInCell = async (
  context: NcContext,
  number: number,
  column: Column,
) => {
  const limit = await getLimit(
    PlanLimitTypes.LIMIT_ATTACHMENTS_IN_CELL,
    context.workspace_id,
  );
  if (number > limit.limit) {
    NcError.get(context).invalidValueForField(
      `Maximum of ${limit.limit} attachments in single cell for column ${column.title}`,
    );
  }
};
