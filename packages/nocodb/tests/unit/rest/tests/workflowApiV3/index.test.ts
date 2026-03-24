import { runOnSet } from '../../../utils/runOnSet';

export const workflowApiV3Test = runOnSet(2, async () => {
  if(isEE()) {
    await import('./workflows.test');
  }
});
