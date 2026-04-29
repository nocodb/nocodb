import {
  FilterCreateContract,
  FilterDeleteContract,
  FilterUpdateContract,
  LinkFilterCreateContract,
  RlsPolicyFilterCreateContract,
  RowColorConditionsCreateContract,
  WidgetFilterCreateContract,
} from '../operations/filters.operations';
import type { FiltersService } from '~/services/filters.service';
import { registerForward } from '~/command-registry/_replay-context';

export function registerFilterHandlers(svc: FiltersService): void {
  registerForward(FilterCreateContract, (ctx, p) => svc.filterCreate(ctx, p));
  registerForward(FilterUpdateContract, (ctx, p) => svc.filterUpdate(ctx, p));
  registerForward(FilterDeleteContract, (ctx, p) => svc.filterDelete(ctx, p));
  registerForward(LinkFilterCreateContract, (ctx, p) =>
    svc.linkFilterCreate(ctx, p),
  );
  registerForward(WidgetFilterCreateContract, (ctx, p) =>
    svc.widgetFilterCreate(ctx, p),
  );
  registerForward(RlsPolicyFilterCreateContract, (ctx, p) =>
    svc.rlsPolicyFilterCreate(ctx, p),
  );
  registerForward(RowColorConditionsCreateContract, (ctx, p) =>
    svc.rowColorConditionsCreate(ctx, p),
  );
}
