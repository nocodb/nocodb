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

  async serializeDocuments(context: NcContext) {
    const allDocs = await Document.listAllWithContent(context, context.base_id);

    return allDocs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      meta: doc.meta,
      order: doc.order,
      parent_id: doc.parent_id,
      has_children: doc.has_children,
      version: doc.version,
    }));
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
