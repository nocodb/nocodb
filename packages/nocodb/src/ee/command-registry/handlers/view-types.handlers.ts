import { OperationRegistry } from '~/command-registry/_registry';
import { makeReplayReq } from '~/command-registry/_replay-context';
import {
  GridViewCreateContract,
  GridViewUpdateContract,
  FormViewCreateContract,
  FormViewUpdateContract,
  GalleryViewCreateContract,
  GalleryViewUpdateContract,
  KanbanViewCreateContract,
  KanbanViewUpdateContract,
  CalendarViewCreateContract,
  CalendarViewUpdateContract,
} from '../operations/view-types.operations';
import type { GridsService } from 'src/ee/services/grids.service';
import type { FormsService } from 'src/ee/services/forms.service';
import type { GalleriesService } from 'src/ee/services/galleries.service';
import type { KanbansService } from 'src/ee/services/kanbans.service';
import type { CalendarsService } from 'src/ee/services/calendars.service';

export function registerViewTypeHandlers(
  gridSvc: GridsService,
  formSvc: FormsService,
  gallerySvc: GalleriesService,
  kanbanSvc: KanbansService,
  calendarSvc: CalendarsService,
): void {
  // ─── Grid ───────────────────────────────────────────────────────────────────

  OperationRegistry.register(
    GridViewCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return gridSvc.gridViewCreate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    GridViewUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return gridSvc.gridViewUpdate(ctx, { ...params, req } as any);
    },
  );

  // ─── Form ───────────────────────────────────────────────────────────────────

  OperationRegistry.register(
    FormViewCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return formSvc.formViewCreate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    FormViewUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return formSvc.formViewUpdate(ctx, { ...params, req } as any);
    },
  );

  // ─── Gallery ────────────────────────────────────────────────────────────────

  OperationRegistry.register(
    GalleryViewCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return gallerySvc.galleryViewCreate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    GalleryViewUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return gallerySvc.galleryViewUpdate(ctx, { ...params, req } as any);
    },
  );

  // ─── Kanban ─────────────────────────────────────────────────────────────────

  OperationRegistry.register(
    KanbanViewCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return kanbanSvc.kanbanViewCreate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    KanbanViewUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return kanbanSvc.kanbanViewUpdate(ctx, { ...params, req } as any);
    },
  );

  // ─── Calendar ───────────────────────────────────────────────────────────────

  OperationRegistry.register(
    CalendarViewCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return calendarSvc.calendarViewCreate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    CalendarViewUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return calendarSvc.calendarViewUpdate(ctx, { ...params, req } as any);
    },
  );
}
