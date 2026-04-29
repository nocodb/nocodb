import {
  ViewSectionCreateContract,
  ViewSectionDeleteContract,
  ViewSectionUpdateContract,
} from '../operations/view-sections.operations';
import type { ViewSectionsService } from '~/services/view-sections.service';
import { registerForward } from '~/command-registry/_replay-context';

export function registerViewSectionHandlers(svc: ViewSectionsService): void {
  registerForward(ViewSectionCreateContract, (ctx, p) =>
    svc.viewSectionCreate(ctx, p),
  );
  registerForward(ViewSectionUpdateContract, (ctx, p) =>
    svc.viewSectionUpdate(ctx, p),
  );
  registerForward(ViewSectionDeleteContract, (ctx, p) =>
    svc.viewSectionDelete(ctx, p),
  );
}
