import { runOnSet } from '../../../utils/runOnSet';
import { isEE } from '../../../utils/helpers';

export const workflowApiV3Test = runOnSet(2, async () => {
  if(isEE()) {
    await import('./workflows.test');
  }
});
