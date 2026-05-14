import { NcBaseError } from 'nocodb-sdk';
import type { MacroTranscriptEntry } from '~/command-registry/types';

export class MacroPartialFailureError extends NcBaseError {
  constructor(
    public readonly failure: {
      index: number;
      childOp: string;
      error: string;
    },
    public readonly partialTranscript: MacroTranscriptEntry[],
    public readonly completedIndexes: number[],
    public readonly totalChildren: number,
  ) {
    super(
      `macroUndo: partial failure — child '${failure.childOp}' at index ${failure.index} threw: ${failure.error}. ${completedIndexes.length} of ${totalChildren} children were inverted before abort.`,
    );
    this.name = 'MacroPartialFailureError';
  }
}
