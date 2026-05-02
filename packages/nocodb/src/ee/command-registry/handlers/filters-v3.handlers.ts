import {
  FilterCreateV3Contract,
  FilterDeleteAllV3Contract,
  FilterReplaceV3Contract,
} from '../operations/filters-v3.operations';
import type { FiltersV3Service } from '~/services/v3/filters-v3.service';
import { registerForward } from '~/command-registry/replay-context';

export function registerFiltersV3Handlers(svc: FiltersV3Service): void {
  registerForward(FilterCreateV3Contract, (ctx, p) => svc.filterCreate(ctx, p));
  registerForward(FilterReplaceV3Contract, (ctx, p) =>
    svc.filterReplace(ctx, p),
  );
  registerForward(FilterDeleteAllV3Contract, (ctx, p) =>
    svc.filterDeleteAll(ctx, p),
  );
}
