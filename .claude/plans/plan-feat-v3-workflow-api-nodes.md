# Plan: Add Node Endpoints to Workflow V3 API

## Context

Currently, workflow nodes are embedded inside workflow create/update requests as `nodes[]` and `edges[]` arrays. This means every node change requires sending the entire workflow payload. We want to:

1. **Add dedicated node CRUD endpoints** under `/api/v3/meta/bases/{base_id}/workflows/{workflow_id}/nodes`
2. **Remove `nodes` and `edges` from workflow create/update requests** — workflows are created empty, nodes managed separately

## Current State

- Nodes are stored as a JSON array in the `nc_workflows.nodes` column (no separate table)
- `WorkflowsService.updateWorkflow()` replaces the entire nodes/edges arrays
- The V3 service wraps `WorkflowsService` — node endpoints will fetch the workflow, manipulate the array, and save back
- `WorkflowGeneralNode` type from SDK: `{ id, type, position: {x,y}, data: {config, title, description?, testResult?, inputVariables?, outputVariables?}, targetPosition, sourcePosition }`
- `WorkflowGeneralEdge` type from SDK: `{ id, source, target, animated, label?, sourcePortId?, targetPortId? }`

## New Endpoints

| Method | Path | ACL | Description |
|--------|------|-----|-------------|
| GET | `/workflows/:workflowId/nodes` | workflowGet | List all nodes + edges |
| GET | `/workflows/:workflowId/nodes/:nodeId` | workflowGet | Get a single node |
| POST | `/workflows/:workflowId/nodes` | workflowUpdate | Add a node (+ optional edges) |
| PATCH | `/workflows/:workflowId/nodes/:nodeId` | workflowUpdate | Update a node |
| DELETE | `/workflows/:workflowId/nodes/:nodeId` | workflowUpdate | Delete a node (+ its edges) |

ACL reuses existing `workflowGet`/`workflowUpdate` permissions — no new ACL entries needed.

---

## Phase 3: Remove nodes/edges from workflow create/update [S]

### Task 3.1: Update Types
- [ ] Remove `nodes`, `edges` from `WorkflowV3CreateReqType`
- [ ] Remove `nodes`, `edges`, `draft` from `WorkflowV3UpdateReqType`

### Task 3.2: Update Swagger Schemas
- [ ] Remove `nodes`, `edges` from `WorkflowCreateReq` schema in swagger-v3.json
- [ ] Remove `nodes`, `edges`, `draft` from `WorkflowUpdateReq` schema in swagger-v3.json

### Task 3.3: Update Service
- [ ] Remove `validateNoTestResult` calls from `workflowCreate` and `workflowUpdate` (no longer accepting nodes)
- [ ] Clean up any node-related logic from create/update methods

### Task 3.4: Update Tests
- [ ] Update workflow create tests — should no longer send nodes/edges in body
- [ ] Update workflow update tests — should no longer send nodes/edges in body
- [ ] Verify existing tests still pass

---

## Phase 4: Node CRUD Endpoints [M]

### Task 4.1: New Types
- [ ] Add `WorkflowNodeV3GetResponseType` — single node response (`id, type, position, data`)
- [ ] Add `WorkflowNodeV3ListResponseType` — `{ nodes: WorkflowGeneralNode[], edges: WorkflowGeneralEdge[] }`
- [ ] Add `WorkflowNodeV3CreateReqType` — `{ id?, type, position, data, edges?: WorkflowGeneralEdge[] }`
- [ ] Add `WorkflowNodeV3UpdateReqType` — partial node update (`{ type?, position?, data? }`)

### Task 4.2: Swagger Schemas
- [ ] Add `WorkflowNodeGetResponse` schema
- [ ] Add `WorkflowNodeListResponse` schema (nodes + edges)
- [ ] Add `WorkflowNodeCreateReq` schema
- [ ] Add `WorkflowNodeUpdateReq` schema
- [ ] Add path definitions for all 5 node endpoints

### Task 4.3: Service Methods
- [ ] `workflowNodeList(context, workflowId)` — fetch workflow, return `{ nodes, edges }`
- [ ] `workflowNodeGet(context, workflowId, nodeId)` — fetch workflow, find node by id or throw `workflowNodeNotFound`
- [ ] `workflowNodeCreate(context, workflowId, body, req)` — fetch workflow, append node to `draft.nodes` (generate id if not provided), optionally append edges to `draft.edges`, save via `updateWorkflow`
- [ ] `workflowNodeUpdate(context, workflowId, nodeId, body, req)` — fetch workflow, find node in `draft.nodes`, merge partial update, save via `updateWorkflow`
- [ ] `workflowNodeDelete(context, workflowId, nodeId, req)` — fetch workflow, remove node from `draft.nodes`, remove all edges referencing this node from `draft.edges`, save via `updateWorkflow`

Key decisions:
- Node operations work on `draft` (unpublished changes), not the published `nodes` array. User calls `/publish` to promote draft to live.
- `validateNoTestResult` check on create/update node bodies
- Generate UUID for node `id` if not provided in create request

### Task 4.4: Controller Routes
- [ ] Add GET `/workflows/:workflowId/nodes` → `workflowNodeList`
- [ ] Add GET `/workflows/:workflowId/nodes/:nodeId` → `workflowNodeGet`
- [ ] Add POST `/workflows/:workflowId/nodes` → `workflowNodeCreate`
- [ ] Add PATCH `/workflows/:workflowId/nodes/:nodeId` → `workflowNodeUpdate`
- [ ] Add DELETE `/workflows/:workflowId/nodes/:nodeId` → `workflowNodeDelete`

### Task 4.5: Unit Tests
- [ ] Test list nodes (returns nodes + edges)
- [ ] Test get single node
- [ ] Test get node not found → 404
- [ ] Test create node (with auto-generated id)
- [ ] Test create node with edges
- [ ] Test update node (partial update)
- [ ] Test delete node (also removes connected edges)
- [ ] Test auth — non-member cannot access node endpoints
