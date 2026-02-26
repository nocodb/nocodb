import { runOnSet } from '../../../utils/runOnSet';

export const workflowApiV3Test = runOnSet(2, async () => {
  await import('./workflows.test');
});
