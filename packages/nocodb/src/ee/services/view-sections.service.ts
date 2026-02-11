import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type {
  ViewSectionCreateReqType,
  ViewSectionType,
  ViewSectionUpdateReqType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { Model, ViewSection } from '~/models';
import { NcError } from '~/helpers/catchError';
import { AppHooksService } from '~/ee/services/app-hooks/app-hooks.service';

@Injectable()
export class ViewSectionsService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async list(context: NcContext, tableId: string): Promise<ViewSectionType[]> {
    return await ViewSection.list(context, tableId);
  }

  async create(
    context: NcContext,
    tableId: string,
    body: ViewSectionCreateReqType,
    req: NcRequest,
  ): Promise<ViewSectionType> {
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const title = body.title?.trim();

    if (!title) {
      NcError.badRequest('Title is required');
    }

    // Look up the table to get source_id
    const model = await Model.get(context, tableId);

    if (!model) {
      NcError.tableNotFound(tableId);
    }

    const section = await ViewSection.insert(context, {
      fk_model_id: tableId,
      title,
      order: body.order,
      meta: body.meta,
      source_id: model.source_id,
      created_by: req.user?.id,
      updated_by: req.user?.id,
    });

    this.appHooksService.emit(AppEvents.VIEW_SECTION_CREATE, {
      req,
      context,
      viewSection: section,
      user: req.user,
    });

    return section;
  }

  async update(
    context: NcContext,
    sectionId: string,
    body: ViewSectionUpdateReqType,
    req: NcRequest,
  ): Promise<ViewSectionType> {
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const existingSection = await ViewSection.get(context, sectionId);

    if (!existingSection) {
      NcError.viewSectionNotFound(sectionId);
    }

    const updateData: Partial<ViewSectionUpdateReqType> & {
      updated_by?: string;
    } = {};

    if (body.title !== undefined) {
      const title = body.title?.trim();
      if (!title) {
        NcError.badRequest('Title cannot be empty');
      }
      updateData.title = title;
    }

    if (body.order !== undefined) {
      updateData.order = body.order;
    }

    if (body.meta !== undefined) {
      updateData.meta = body.meta;
    }

    updateData.updated_by = req.user?.id;

    const section = await ViewSection.update(
      context,
      sectionId,
      updateData as any,
    );

    this.appHooksService.emit(AppEvents.VIEW_SECTION_UPDATE, {
      req,
      context,
      viewSection: section,
      user: req.user,
    });

    return section;
  }

  async delete(
    context: NcContext,
    sectionId: string,
    req: NcRequest,
  ): Promise<boolean> {
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const existingSection = await ViewSection.get(context, sectionId);

    if (!existingSection) {
      NcError.viewSectionNotFound(sectionId);
    }

    // Delete the section (views inside will be moved to top-level by the model)
    await ViewSection.delete(context, sectionId);

    this.appHooksService.emit(AppEvents.VIEW_SECTION_DELETE, {
      req,
      context,
      viewSection: existingSection,
      user: req.user,
    });

    return true;
  }
}
