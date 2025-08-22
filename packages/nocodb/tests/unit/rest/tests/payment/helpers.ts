import type { Base } from '../../../../../src/models';
import type init from '../../../init';

export interface ITestContext {
  context: Awaited<ReturnType<typeof init>>;
  ctx: {
    workspace_id: any;
    base_id: any;
  };
  base: Base;
}
