import { z } from 'zod';
import { NcApiVersion } from 'nocodb-sdk';

const MODEL_TYPES = ['table', 'view'] as const;
const boolType = z.union([z.boolean(), z.literal(0), z.literal(1)]);

/**
 * Column-create request body (per V1/V2 NormalColumnRequestType). The
 * service runs its own swagger validation on the inner payload; the
 * contract just needs to accept the shape so it round-trips through
 * recording. Loose object with title required.
 */
const columnRequestSchema = z
  .object({
    title: z.string().optional(),
    column_name: z.string().optional(),
    uidt: z.string().optional(),
    dt: z.string().nullable().optional(),
    np: z.string().nullable().optional(),
    ns: z.string().nullable().optional(),
    clen: z.string().nullable().optional(),
    cop: z.string().nullable().optional(),
    pk: boolType.optional(),
    pv: boolType.optional(),
    rqd: boolType.optional(),
    un: boolType.optional(),
    ai: boolType.optional(),
    unique: boolType.optional(),
    cdf: z.string().nullable().optional(),
    cc: z.string().nullable().optional(),
    csn: z.string().nullable().optional(),
    dtxp: z.string().nullable().optional(),
    dtxs: z.string().nullable().optional(),
    meta: z.record(z.unknown()).nullable().optional(),
    description: z.string().nullable().optional(),
    order: z.number().optional(),
    /** Replay injection — sandboxColumnIds map title → id. */
    id: z.string().optional(),
  })
  .passthrough();

/**
 * V1/V2 table body. Required: title for create. Replay-time / system
 * fields included so snapshot-inverse round-trips.
 */
export const tableBodySchema = z
  .object({
    title: z.string().optional(),
    table_name: z.string().optional(),
    description: z.string().nullable().optional(),
    meta: z.record(z.unknown()).nullable().optional(),
    order: z.number().optional(),
    columns: z.array(columnRequestSchema).optional(),
    type: z.enum(MODEL_TYPES).optional(),
    /** Replay injection (idField: 'table'). */
    id: z.string().optional(),
    enabled: boolType.optional(),
    mm: boolType.optional(),
    synced: boolType.optional(),
  })
  .strict();

export const tableCreateSchema = z
  .object({
    baseId: z.string(),
    sourceId: z.string().optional(),
    table: tableBodySchema,
    synced: z.boolean().optional(),
    apiVersion: z.nativeEnum(NcApiVersion).optional(),
    isDuplicateOperation: z.boolean().optional(),
  })
  .strict();

export const tableUpdateSchema = z
  .object({
    tableId: z.string(),
    table: tableBodySchema.optional(),
    baseId: z.string().optional(),
  })
  .strict();

export const tableDeleteSchema = z
  .object({
    tableId: z.string(),
    forceDeleteRelations: z.boolean().optional(),
    forceDeleteSyncs: z.boolean().optional(),
    skipLinkPlaceholder: z.boolean().optional(),
    skipTrash: z.boolean().optional(),
  })
  .strict();

// ── V3 ───────────────────────────────────────────────────────────

/**
 * V3 field shape — used inside `tableV3Create`'s fields[]. Looser than
 * V1's columns[] because V3 splits virtual vs physical and the inner
 * service runs per-uidt validation against `swagger-v3.json#/components/
 * schemas/FieldOptions/<type>` itself.
 */
const v3FieldSchema = z
  .object({
    title: z.string().optional(),
    name: z.string().optional(),
    type: z.string().optional(),
    description: z.string().nullable().optional(),
    options: z.record(z.unknown()).optional(),
    /** Replay injection — V3 fan-out matches by title. */
    id: z.string().optional(),
  })
  .passthrough();

const v3MetaSchema = z
  .object({
    icon: z.string().optional(),
  })
  .strict();

export const tableV3BodySchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    table_name: z.string().optional(),
    description: z.string().nullable().optional(),
    fields: z.array(v3FieldSchema).optional(),
    meta: v3MetaSchema.optional(),
    /** TableUpdateV3 carries display_field_id; harmless on create. */
    display_field_id: z.string().optional(),
  })
  .passthrough();

export const tableV3CreateSchema = z
  .object({
    baseId: z.string(),
    table: tableV3BodySchema,
    sourceId: z.string().optional(),
  })
  .strict();
