import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import { PlanFeatureTypes } from 'nocodb-sdk';
import type {
  ViewSectionCreateReqType,
  ViewSectionType,
  ViewSectionUpdateReqType,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { NcContext } from '~/interface/config';
import { Model, ViewSection } from '~/models';
import { NcError } from '~/helpers/catchError';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { AppHooksService } from '~/ee/services/app-hooks/app-hooks.service';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import {
  descCreate,
  descDelete,
  descUpdate,
} from '~/decorators/trace-command-descriptions';
import { MetaTable } from '~/utils/globals';

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
    await checkForFeature(context, PlanFeatureTypes.FEATURE_VIEW_SECTIONS);

    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const title = body.title?.trim();

    if (!title) {
      NcError.badRequest('Title is required');
    }

    // Check for duplicate title within the same table using direct query
    const duplicate = await ViewSection.findByTitle(context, tableId, title);
    if (duplicate) {
      NcError.badRequest('A section with this name already exists');
    }

    // Look up the table to get source_id
    const model = await Model.get(context, tableId);

    if (!model) {
      NcError.tableNotFound(tableId);
    }

    const section = await ViewSection.insert(context, {
      ...(context?.additionalContext?.is_replay && (body as any).id
        ? { id: (body as any).id }
        : {}),
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
    await checkForFeature(context, PlanFeatureTypes.FEATURE_VIEW_SECTIONS);

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

      // Check for duplicate title within the same table (exclude self)
      if (title !== existingSection.title?.trim()) {
        const duplicate = await ViewSection.findByTitle(
          context,
          existingSection.fk_model_id,
          title,
          sectionId,
        );
        if (duplicate) {
          NcError.badRequest('A section with this name already exists');
        }
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
    await checkForFeature(context, PlanFeatureTypes.FEATURE_VIEW_SECTIONS);

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

  // ────────────────────────────────────────────
  // Sandbox-traced wrappers (standard (context, param) signature)
  // ────────────────────────────────────────────

  @TraceCommand({
    entity: MetaTable.VIEW_SECTIONS,
    entityId: 'id',
    entityTitle: 'title',
    parentId: 'viewId',
    description: descCreate('view section'),
    idField: 'section',
  })
  async viewSectionCreate(
    context: NcContext,
    param: {
      viewId: string;
      section: ViewSectionCreateReqType;
      req: NcRequest;
    },
  ): Promise<ViewSectionType> {
    return this.create(context, param.viewId, param.section, param.req);
  }

  @TraceCommand({
    entity: MetaTable.VIEW_SECTIONS,
    entityId: (p) => p?.viewSectionId,
    entityTitle: (p) => p?.section?.title,
    description: descUpdate('view section'),
  })
  async viewSectionUpdate(
    context: NcContext,
    param: {
      viewSectionId: string;
      section: ViewSectionUpdateReqType;
      req: NcRequest;
    },
  ): Promise<ViewSectionType> {
    return this.update(context, param.viewSectionId, param.section, param.req);
  }

  @TraceCommand({
    entity: MetaTable.VIEW_SECTIONS,
    entityId: (p) => p?.viewSectionId,
    description: descDelete('view section'),
  })
  async viewSectionDelete(
    context: NcContext,
    param: { viewSectionId: string; req: NcRequest },
  ): Promise<boolean> {
    return this.delete(context, param.viewSectionId, param.req);
  }
}
