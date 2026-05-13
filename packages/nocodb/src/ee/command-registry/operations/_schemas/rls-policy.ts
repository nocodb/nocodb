import { z } from 'zod';
import { filterBodySchema } from './filter';

const RLS_DEFAULT_BEHAVIORS = ['show_all', 'deny_all', 'condition'] as const;
const RLS_SUBJECT_TYPES = ['user', 'team', 'role'] as const;

const boolType = z.union([z.boolean(), z.literal(0), z.literal(1)]);

const rlsSubjectSchema = z
  .object({
    type: z.enum(RLS_SUBJECT_TYPES),
    id: z.string(),
    hierarchy_scope: z.enum(['self_only', 'self_and_descendants']).optional(),
  })
  .strict();

export const rlsPolicyCreateSchema = z
  .object({
    body: z
      .object({
        id: z.string().optional(),
        fk_model_id: z.string(),
        title: z.string().optional(),
        enabled: boolType.optional(),
        is_default: boolType.optional(),
        default_behavior: z.enum(RLS_DEFAULT_BEHAVIORS).optional(),
        order: z.number().optional(),
        meta: z.union([z.record(z.unknown()), z.string(), z.null()]).optional(),
        subjects: z.array(rlsSubjectSchema).optional(),
        /** Bundled filter rows for atomic save (rls + initial filter tree). */
        filters: z.array(filterBodySchema).optional(),
      })
      .strict(),
  })
  .strict();

export const rlsPolicyUpdateSchema = z
  .object({
    body: z
      .object({
        id: z.string(),
        title: z.string().optional(),
        enabled: boolType.optional(),
        is_default: boolType.optional(),
        default_behavior: z.enum(RLS_DEFAULT_BEHAVIORS).optional(),
        order: z.number().optional(),
        meta: z.union([z.record(z.unknown()), z.string(), z.null()]).optional(),
      })
      .strict(),
  })
  .strict();

export const rlsPolicyDeleteSchema = z
  .object({
    policyId: z.string(),
  })
  .strict();

export const rlsPolicySetSubjectsSchema = z
  .object({
    policyId: z.string(),
    subjects: z.array(rlsSubjectSchema),
  })
  .strict();

export const rlsPolicyFilterCreateSchema = z
  .object({
    rlsPolicyId: z.string(),
    filter: filterBodySchema,
  })
  .strict();
