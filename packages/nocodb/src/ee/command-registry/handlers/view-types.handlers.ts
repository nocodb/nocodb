import {
  CalendarViewCreateContract,
  CalendarViewUpdateContract,
  FormViewCreateContract,
  FormViewUpdateContract,
  GalleryViewCreateContract,
  GalleryViewUpdateContract,
  GridViewCreateContract,
  GridViewUpdateContract,
  KanbanViewCreateContract,
  KanbanViewUpdateContract,
} from '../operations/view-types.operations';
import type { GridsService } from '~/services/grids.service';
import type { FormsService } from '~/services/forms.service';
import type { GalleriesService } from '~/services/galleries.service';
import type { KanbansService } from '~/services/kanbans.service';
import type { CalendarsService } from '~/services/calendars.service';
import { registerForward } from '~/command-registry/replay-context';

export function registerViewTypeHandlers(
  gridSvc: GridsService,
  formSvc: FormsService,
  gallerySvc: GalleriesService,
  kanbanSvc: KanbansService,
  calendarSvc: CalendarsService,
): void {
  registerForward(GridViewCreateContract, (ctx, p) =>
    gridSvc.gridViewCreate(ctx, p),
  );
  registerForward(GridViewUpdateContract, (ctx, p) =>
    gridSvc.gridViewUpdate(ctx, p),
  );

  registerForward(FormViewCreateContract, (ctx, p) =>
    formSvc.formViewCreate(ctx, p),
  );
  registerForward(FormViewUpdateContract, (ctx, p) =>
    formSvc.formViewUpdate(ctx, p),
  );

  registerForward(GalleryViewCreateContract, (ctx, p) =>
    gallerySvc.galleryViewCreate(ctx, p),
  );
  registerForward(GalleryViewUpdateContract, (ctx, p) =>
    gallerySvc.galleryViewUpdate(ctx, p),
  );

  registerForward(KanbanViewCreateContract, (ctx, p) =>
    kanbanSvc.kanbanViewCreate(ctx, p),
  );
  registerForward(KanbanViewUpdateContract, (ctx, p) =>
    kanbanSvc.kanbanViewUpdate(ctx, p),
  );

  registerForward(CalendarViewCreateContract, (ctx, p) =>
    calendarSvc.calendarViewCreate(ctx, p),
  );
  registerForward(CalendarViewUpdateContract, (ctx, p) =>
    calendarSvc.calendarViewUpdate(ctx, p),
  );
}
