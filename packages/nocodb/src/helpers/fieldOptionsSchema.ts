import { swaggerV3Validation } from '~/schema';

/**
 * The per-type `options` schema ajv actually validates against.
 *
 * Resolved by following the `FieldOptions` discriminator's `$ref` rather than
 * guessing `FieldOptions_<type>`: the validation patch overrides some of the
 * refs, and eleven uidts (ID, ForeignKey, Collaborator, GeoData, Colour, Count,
 * SpecificDBType, Order, Deleted, Meta, UUID) have no entry. Returns null for
 * those — `validatePayload` turns an unresolvable ref into a 404, so callers
 * must skip validation rather than assume the ref resolves.
 */
export function resolveFieldOptionsSchema(type: string): {
  ref: string;
  // Typed loosely on purpose: the imported JSON literal narrows each entry to
  // its own shape, so it cannot be indexed uniformly.
  options: any;
  schema: any;
} | null {
  const schemas: Record<string, any> = swaggerV3Validation.components.schemas;
  if (!schemas.FieldOptions?.[type]) return null;

  const options = schemas.FieldOptions[type].properties?.options;
  const ref =
    typeof options?.$ref === 'string' ? options.$ref.split('/').pop() : null;

  return {
    ref: `swagger-v3.json#/components/schemas/FieldOptions/${type}`,
    options,
    schema: (ref && schemas[ref]) || options,
  };
}
