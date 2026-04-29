import { registerForward } from '~/command-registry/_replay-context';
import {
  SortCreateContract,
  SortUpdateContract,
  SortDeleteContract,
  ViewColumnUpdateContract,
  VisibilityUpdateContract,
} from '../operations/sorts-visibilities.operations';
import type { SortsService } from 'src/ee/services/sorts.service';
import type { ViewColumnsService } from 'src/ee/services/view-columns.service';
import type { ModelVisibilitiesService } from 'src/ee/services/model-visibilities.service';

export function registerSortHandlers(svc: SortsService): void {
  registerForward(SortCreateContract, (ctx, p) => svc.sortCreate(ctx, p));
  registerForward(SortUpdateContract, (ctx, p) => svc.sortUpdate(ctx, p));
  registerForward(SortDeleteContract, (ctx, p) => svc.sortDelete(ctx, p));
}

export function registerViewColumnHandlers(svc: ViewColumnsService): void {
  registerForward(ViewColumnUpdateContract, (ctx, p) => svc.columnUpdate(ctx, p));
}

export function registerVisibilityHandlers(
  svc: ModelVisibilitiesService,
): void {
  registerForward(VisibilityUpdateContract, (ctx, p) => svc.xcVisibilityMetaSetAll(ctx, p));
}
