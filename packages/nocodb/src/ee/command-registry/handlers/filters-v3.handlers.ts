import { FilterCreateV3Contract } from '../operations/filters-v3.operations';
import type { FiltersV3Service } from '~/services/v3/filters-v3.service';
import { registerForward } from '~/command-registry/_replay-context';

export function registerFiltersV3Handlers(svc: FiltersV3Service): void {
  registerForward(FilterCreateV3Contract, (ctx, p) => svc.filterCreate(ctx, p));
}
