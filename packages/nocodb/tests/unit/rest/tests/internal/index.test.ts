import { internalUiViewTests } from './ui-view/index.test';
import { internalDocumentTests } from './documents/index.test';
import { isEE } from '../../../utils/helpers';
import { runOnSet } from '../../../utils/runOnSet';

export const internalTests = runOnSet(2, function () {
  describe('Internal API', () => {
    internalUiViewTests();
    internalDocumentTests();

    if (isEE()) {
      try {
        require('./ee/base-trash.test').baseTrashTests();
        require('./ee/m2m-junction-cleanup.test').m2mJunctionCleanupTests();
        require('./ee/base-hard-delete-orphans.test').baseHardDeleteOrphansTests();
        require('./ee/meta-satellite-trx-guard.test').metaSatelliteTrxGuardTests();
        require('./ee/clean-up-processor.test').cleanUpProcessorTests();
        require('./ee/base-trash-field.test').baseTrashFieldTests();
        require('./ee/base-trash-table.test').baseTrashTableTests();
        require('./ee/date-dependency.test').dateDependencyTests();
        require('./ee/sandbox-trace-command.test').sandboxTraceCommandTests();
        require('./ee/sandbox-merge-roundtrip.test').sandboxMergeRoundtripTests();
        require('./ee/sandbox-merge-delete.test').sandboxMergeDeleteTests();
        require('./ee/sandbox-merge-selective.test').sandboxMergeSelectiveTests();
        require('./ee/sandbox-discard.test').sandboxDiscardTests();
        require('./ee/sandbox-master-guard.test').sandboxMasterGuardTests();
        require('./ee/sandbox-base-variables.test').sandboxBaseVariablesTests();
        require('./ee/sandbox-id-preservation.test').sandboxIdPreservationTests();
        require('./ee/ltar-conversion-readall.test').ltarConversionReadAllTests();
        require('./ee/undo-redo-roundtrip.test').undoRedoRoundtripTests();
        require('./ee/undo-redo/index.test').undoRedoFullCoverageTests();
        require('./ee/docs-collab-protocol.test').docsCollabProtocolTests();
        require('./ee/docs-collab-persist.test').docsCollabPersistTests();
        require('./pubsub-redis-demux.test').pubSubRedisDemuxTests();
        require('./ee/tableSyncUndoRedo.test').tableSyncUndoRedoTests();
      } catch (e) {
        // EE test files not available in CE
      }
    }
  });
});
