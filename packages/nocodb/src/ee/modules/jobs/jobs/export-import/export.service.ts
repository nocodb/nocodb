import { Injectable } from '@nestjs/common';
// import debug from 'debug';
import { ExportService as ExportServiceCE } from 'src/modules/jobs/jobs/export-import/export.service';
import type { NcRequest } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { DatasService } from '~/services/datas.service';
import { Workflow } from '~/models';
import Document from '~/models/Document';
import { extractWorkflowDependencies } from '~/services/workflows/extractDependency';
import { deepReplaceStrings } from '~/helpers/stringHelpers';

@Injectable()
export class ExportService extends ExportServiceCE {
  constructor(datasService: DatasService) {
    super(datasService);
  }

  // Chunk size for paginating doc content loads during export. Bounds the
  // peak number of ProseMirror payloads held in the fetch buffer to this
  // many, independent of total doc count in the base.
  private static readonly DOC_EXPORT_CHUNK_SIZE = 50;

  async serializeDocuments(context: NcContext) {
    // Metadata-only list is cheap — no content included.
    const lite = await Document.listAllLite(context, context.base_id);
    if (!lite.length) return [];

    const ids = lite.map((d) => d.id!).filter(Boolean);
    const serialized: Array<Record<string, any>> = [];

    for (let i = 0; i < ids.length; i += ExportService.DOC_EXPORT_CHUNK_SIZE) {
      const chunk = ids.slice(i, i + ExportService.DOC_EXPORT_CHUNK_SIZE);
      const docs = await Document.listWithContent(context, chunk);
      for (const doc of docs) {
        serialized.push({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          meta: doc.meta,
          order: doc.order,
          parent_id: doc.parent_id,
          has_children: doc.has_children,
          version: doc.version,
        });
      }
    }

    return serialized;
  }

  async serializeWorkflows(context: NcContext, param: any, _req: NcRequest) {
    const { idMap } = param;
    const serializedWorkflows = [];

    const workflows = await Workflow.list(context, context.base_id);

    const buildDependencyMap = (nodes: any): Map<string, string> => {
      if (!nodes) return new Map();

      const deps = extractWorkflowDependencies(nodes);

      const flattened = [
        ...(deps.columns || []),
        ...(deps.models || []),
        ...(deps.views || []),
      ];

      const map = new Map<string, string>();
      for (const dep of flattened) {
        const newId = idMap.get(dep.id);
        if (newId) map.set(dep.id, newId);
      }
      return map;
    };

    for (const workflow of workflows) {
      const mapDefault = buildDependencyMap(workflow.nodes);
      const mapDraft = buildDependencyMap(workflow.draft?.nodes);

      const updatedNodes = deepReplaceStrings(workflow.nodes, mapDefault);

      const updatedDraftNodes = workflow.draft?.nodes
        ? deepReplaceStrings(workflow.draft.nodes, mapDraft)
        : undefined;

      const updatedEdges = deepReplaceStrings(workflow.edges, mapDefault);

      serializedWorkflows.push({
        title: workflow.title,
        description: workflow.description,
        meta: workflow.meta,
        nodes: updatedNodes,
        edges: updatedEdges,
        draft: workflow.draft
          ? {
              ...workflow.draft,
              nodes: updatedDraftNodes,
            }
          : undefined,
      });
    }

    return serializedWorkflows;
  }
}
