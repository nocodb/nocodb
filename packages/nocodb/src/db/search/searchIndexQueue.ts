import type { NcContext } from '~/interface/config';

// Search indexes are EE; EE shadows this file.

export const searchIndexQueue = {
  /** Holds the table's index writes until the returned release runs. */
  hold(_context: NcContext, _modelId: string): () => void {
    return () => {};
  },
};
