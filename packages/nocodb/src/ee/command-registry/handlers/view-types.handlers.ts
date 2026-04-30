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
  ListViewCreateContract,
  ListViewUpdateContract,
  MapViewCreateContract,
  MapViewUpdateContract,
  TimelineViewCreateContract,
  TimelineViewUpdateContract,
} from '../operations/view-types.operations';
import type { GridsService } from '~/services/grids.service';
import type { FormsService } from '~/services/forms.service';
import type { GalleriesService } from '~/services/galleries.service';
import type { KanbansService } from '~/services/kanbans.service';
import type { CalendarsService } from '~/services/calendars.service';
import type { ListsService } from '~/ee/services/lists.service';
import type { TimelinesService } from '~/services/timelines.service';
import type { MapsService } from '~/services/maps.service';
import { registerForward } from '~/command-registry/replay-context';

export function registerViewTypeHandlers(
  gridSvc: GridsService,
  formSvc: FormsService,
  gallerySvc: GalleriesService,
  kanbanSvc: KanbansService,
  calendarSvc: CalendarsService,
  listSvc: ListsService,
  timelineSvc: TimelinesService,
  mapSvc: MapsService,
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

  registerForward(ListViewCreateContract, (ctx, p) =>
    listSvc.listViewCreate(ctx, p),
  );
  registerForward(ListViewUpdateContract, (ctx, p) =>
    listSvc.listViewUpdate(ctx, p),
  );

  registerForward(TimelineViewCreateContract, (ctx, p) =>
    timelineSvc.timelineViewCreate(ctx, p),
  );
  registerForward(TimelineViewUpdateContract, (ctx, p) =>
    timelineSvc.timelineViewUpdate(ctx, p),
  );

  registerForward(MapViewCreateContract, (ctx, p) =>
    mapSvc.mapViewCreate(ctx, p),
  );
  registerForward(MapViewUpdateContract, (ctx, p) =>
    mapSvc.mapViewUpdate(ctx, p),
  );
}
