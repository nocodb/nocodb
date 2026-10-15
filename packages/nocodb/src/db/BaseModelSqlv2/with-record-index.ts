import { NcBaseErrorv2, type NcContext, NcErrorType } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';

/**
 * Runs one record's preparation in a batch, prefixing an invalid-value error
 * with `Record N:` so the failure points at the entry at fault.
 */
export const withRecordIndex = async <T>(
  context: NcContext,
  index: number,
  batchSize: number,
  fn: () => Promise<T>,
): Promise<T> => {
  try {
    return await fn();
  } catch (e) {
    if (
      batchSize > 1 &&
      e instanceof NcBaseErrorv2 &&
      e.error === NcErrorType.ERR_INVALID_VALUE_FOR_FIELD
    ) {
      NcError.get(context).invalidValueForField(
        `Record ${index}: ${e.message}`,
      );
    }
    throw e;
  }
};
