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
import { overrideConflictingViewByTitle } from './view-replay-conflict';
import type { GridsService } from '~/services/grids.service';
import type { FormsService } from '~/services/forms.service';
import type { GalleriesService } from '~/services/galleries.service';
import type { KanbansService } from '~/services/kanbans.service';
import type { CalendarsService } from '~/services/calendars.service';
import type { ListsService } from '~/ee/services/lists.service';
import type { TimelinesService } from '~/services/timelines.service';
import type { MapsService } from '~/services/maps.service';
import type { NcContext } from '~/interface/config';
import type { OperationContract } from '~/command-registry/types';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';
import { OperationRegistry } from '~/command-registry/registry';

function registerViewCreate(
  contract: OperationContract,
  bodyKey: string,
  forward: (ctx: NcContext, p: any) => Promise<unknown>,
): void {
  OperationRegistry.register(contract, async (ctx, params, meta) => {
    const req = makeReplayReq(meta.originalReq, meta.createdBy);
    const body = (params as any)[bodyKey];
    if (body?.title) {
      await overrideConflictingViewByTitle(
        ctx,
        (params as any).tableId,
        body.title,
        body.id,
      );
    }
    return forward(ctx, { ...params, req });
  });
}

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
  registerViewCreate(GridViewCreateContract, 'grid', (ctx, p) =>
    gridSvc.gridViewCreate(ctx, p),
  );
  registerForward(GridViewUpdateContract, (ctx, p) =>
    gridSvc.gridViewUpdate(ctx, p),
  );

  registerViewCreate(FormViewCreateContract, 'body', (ctx, p) =>
    formSvc.formViewCreate(ctx, p),
  );
  registerForward(FormViewUpdateContract, (ctx, p) =>
    formSvc.formViewUpdate(ctx, p),
  );

  registerViewCreate(GalleryViewCreateContract, 'gallery', (ctx, p) =>
    gallerySvc.galleryViewCreate(ctx, p),
  );
  registerForward(GalleryViewUpdateContract, (ctx, p) =>
    gallerySvc.galleryViewUpdate(ctx, p),
  );

  registerViewCreate(KanbanViewCreateContract, 'kanban', (ctx, p) =>
    kanbanSvc.kanbanViewCreate(ctx, p),
  );
  registerForward(KanbanViewUpdateContract, (ctx, p) =>
    kanbanSvc.kanbanViewUpdate(ctx, p),
  );

  registerViewCreate(CalendarViewCreateContract, 'calendar', (ctx, p) =>
    calendarSvc.calendarViewCreate(ctx, p),
  );
  registerForward(CalendarViewUpdateContract, (ctx, p) =>
    calendarSvc.calendarViewUpdate(ctx, p),
  );

  registerViewCreate(ListViewCreateContract, 'list', (ctx, p) =>
    listSvc.listViewCreate(ctx, p),
  );
  registerForward(ListViewUpdateContract, (ctx, p) =>
    listSvc.listViewUpdate(ctx, p),
  );

  registerViewCreate(TimelineViewCreateContract, 'timeline', (ctx, p) =>
    timelineSvc.timelineViewCreate(ctx, p),
  );
  registerForward(TimelineViewUpdateContract, (ctx, p) =>
    timelineSvc.timelineViewUpdate(ctx, p),
  );

  registerViewCreate(MapViewCreateContract, 'map', (ctx, p) =>
    mapSvc.mapViewCreate(ctx, p),
  );
  registerForward(MapViewUpdateContract, (ctx, p) =>
    mapSvc.mapViewUpdate(ctx, p),
  );
}
