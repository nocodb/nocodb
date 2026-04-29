import { registerForward } from '~/command-registry/_replay-context';
import {
  ViewSectionCreateContract,
  ViewSectionUpdateContract,
  ViewSectionDeleteContract,
} from '../operations/view-sections.operations';
import type { ViewSectionsService } from 'src/ee/services/view-sections.service';

export function registerViewSectionHandlers(svc: ViewSectionsService): void {
  registerForward(ViewSectionCreateContract, (ctx, p) => svc.viewSectionCreate(ctx, p));
  registerForward(ViewSectionUpdateContract, (ctx, p) => svc.viewSectionUpdate(ctx, p));
  registerForward(ViewSectionDeleteContract, (ctx, p) => svc.viewSectionDelete(ctx, p));
}
