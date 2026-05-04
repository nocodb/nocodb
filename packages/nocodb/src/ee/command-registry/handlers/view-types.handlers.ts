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
  ListViewLevelsRestoreContract,
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
import type { BaseTrashService } from '~/services/base-trash/base-trash.service';
import type { NcContext } from '~/interface/config';
import type { OperationContract } from '~/command-registry/types';
import BaseTrash from '~/ee/models/BaseTrash';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';
import { OperationRegistry } from '~/command-registry/registry';

function registerViewCreate(
  contract: OperationContract,
  bodyKey: string,
  forward: (ctx: NcContext, p: any) => Promise<unknown>,
  baseTrashSvc: BaseTrashService,
): void {
  OperationRegistry.register(contract, async (ctx, params, meta) => {
    const req = makeReplayReq(meta.originalReq, meta.createdBy);

    // Redo of a view create (regular OR duplicate via `copy_from_id`): the
    // undo soft-deleted the view, leaving its row in `_nc_view` with
    // `deleted_at` set + a `nc_trash` entry that snapshots all children.
    // A fresh create with the same id would collide with the soft-deleted
    // row, so detect the trashed id and restore from trash instead.
    // Sandbox replay on a production base never has the id in trash, so
    // the check is a cheap miss in that path.
    if (ctx.additionalContext?.is_replay && meta.entityId) {
      const trashEntry = await BaseTrash.getByResourceId(
        ctx,
        'view',
        meta.entityId,
      );
      if (trashEntry?.id) {
        return baseTrashSvc.restore(ctx, {
          trashId: trashEntry.id,
          user: req.user,
          req,
        });
      }
    }

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
  baseTrashSvc: BaseTrashService,
): void {
  registerViewCreate(
    GridViewCreateContract,
    'grid',
    (ctx, p) => gridSvc.gridViewCreate(ctx, p),
    baseTrashSvc,
  );
  registerForward(GridViewUpdateContract, (ctx, p) =>
    gridSvc.gridViewUpdate(ctx, p),
  );

  registerViewCreate(
    FormViewCreateContract,
    'body',
    (ctx, p) => formSvc.formViewCreate(ctx, p),
    baseTrashSvc,
  );
  registerForward(FormViewUpdateContract, (ctx, p) =>
    formSvc.formViewUpdate(ctx, p),
  );

  registerViewCreate(
    GalleryViewCreateContract,
    'gallery',
    (ctx, p) => gallerySvc.galleryViewCreate(ctx, p),
    baseTrashSvc,
  );
  registerForward(GalleryViewUpdateContract, (ctx, p) =>
    gallerySvc.galleryViewUpdate(ctx, p),
  );

  registerViewCreate(
    KanbanViewCreateContract,
    'kanban',
    (ctx, p) => kanbanSvc.kanbanViewCreate(ctx, p),
    baseTrashSvc,
  );
  registerForward(KanbanViewUpdateContract, (ctx, p) =>
    kanbanSvc.kanbanViewUpdate(ctx, p),
  );

  registerViewCreate(
    CalendarViewCreateContract,
    'calendar',
    (ctx, p) => calendarSvc.calendarViewCreate(ctx, p),
    baseTrashSvc,
  );
  registerForward(CalendarViewUpdateContract, (ctx, p) =>
    calendarSvc.calendarViewUpdate(ctx, p),
  );

  registerViewCreate(
    ListViewCreateContract,
    'list',
    (ctx, p) => listSvc.listViewCreate(ctx, p),
    baseTrashSvc,
  );
  registerForward(ListViewUpdateContract, (ctx, p) =>
    listSvc.listViewUpdate(ctx, p),
  );
  registerForward(ListViewLevelsRestoreContract, (ctx, p) =>
    listSvc.restoreListViewLevels(
      ctx,
      p as Parameters<typeof listSvc.restoreListViewLevels>[1],
    ),
  );

  registerViewCreate(
    TimelineViewCreateContract,
    'timeline',
    (ctx, p) => timelineSvc.timelineViewCreate(ctx, p),
    baseTrashSvc,
  );
  registerForward(TimelineViewUpdateContract, (ctx, p) =>
    timelineSvc.timelineViewUpdate(ctx, p),
  );

  registerViewCreate(
    MapViewCreateContract,
    'map',
    (ctx, p) => mapSvc.mapViewCreate(ctx, p),
    baseTrashSvc,
  );
  registerForward(MapViewUpdateContract, (ctx, p) =>
    mapSvc.mapViewUpdate(ctx, p),
  );
}
