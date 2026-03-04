import { z } from 'zod';
import { ProjectRoles, ViewTypes } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { GridsService } from '~/services/grids.service';
import { FormsService } from '~/services/forms.service';
import { GalleriesService } from '~/services/galleries.service';
import { KanbansService } from '~/services/kanbans.service';
import { CalendarsService } from '~/services/calendars.service';
import Noco from '~/Noco';

const VIEW_TYPE_MAP: Record<string, ViewTypes> = {
  grid: ViewTypes.GRID,
  form: ViewTypes.FORM,
  gallery: ViewTypes.GALLERY,
  kanban: ViewTypes.KANBAN,
  calendar: ViewTypes.CALENDAR,
};

export const createViewTool: ChatToolDefinition = {
  name: 'create_view',
  description:
    'Create a new view for a table. Each table can have multiple views of different types: ' +
    'grid (spreadsheet-like, default), gallery (card layout), kanban (column-grouped cards), ' +
    'form (data entry form), or calendar (date-based layout). ' +
    'Each view has its own filters, sorts, field visibility, and group-by settings. ' +
    'After creating a view, use add_filter, add_sort, or set_group_by to configure it.',
  parameters: {
    table_name: z
      .string()
      .describe('The title of the table to add a view to (case-insensitive).'),
    title: z
      .string()
      .describe(
        'The display name for the new view. Must be unique within the table.',
      ),
    type: z
      .enum(['grid', 'form', 'gallery', 'kanban', 'calendar'])
      .describe(
        'The view type: "grid" (spreadsheet), "gallery" (cards), "kanban" (grouped columns), ' +
          '"form" (data entry), "calendar" (date-based). Most use cases want "grid".',
      ),
  },
  permission: 'viewCreate',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { table_name: string; title: string; type: string },
    req: NcRequest,
  ) {
    const model = await resolveTableByName(context, args.table_name);

    const viewType = VIEW_TYPE_MAP[args.type];
    if (!viewType) {
      throw new Error(`Invalid view type: ${args.type}`);
    }

    const viewBody = { title: args.title };
    const serviceParam = { tableId: model.id!, req };
    let view;

    switch (viewType) {
      case ViewTypes.GRID: {
        const svc: GridsService = Noco.nestApp.get(GridsService);
        view = await svc.gridViewCreate(context, {
          ...serviceParam,
          grid: viewBody,
        });
        break;
      }
      case ViewTypes.FORM: {
        const svc: FormsService = Noco.nestApp.get(FormsService);
        view = await svc.formViewCreate(context, {
          ...serviceParam,
          body: viewBody,
        });
        break;
      }
      case ViewTypes.GALLERY: {
        const svc: GalleriesService = Noco.nestApp.get(GalleriesService);
        view = await svc.galleryViewCreate(context, {
          ...serviceParam,
          gallery: viewBody,
        });
        break;
      }
      case ViewTypes.KANBAN: {
        const svc: KanbansService = Noco.nestApp.get(KanbansService);
        view = await svc.kanbanViewCreate(context, {
          ...serviceParam,
          kanban: viewBody,
        });
        break;
      }
      case ViewTypes.CALENDAR: {
        const svc: CalendarsService = Noco.nestApp.get(CalendarsService);
        view = await svc.calendarViewCreate(context, {
          ...serviceParam,
          calendar: viewBody,
        });
        break;
      }
    }

    return {
      id: view.id,
      title: view.title,
      type: args.type,
      message: `${args.type} view "${args.title}" created for table "${args.table_name}".`,
    };
  },
};
