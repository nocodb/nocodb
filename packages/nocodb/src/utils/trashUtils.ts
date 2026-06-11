import { ModelTypes } from 'nocodb-sdk';

/**
 * xcCondition to filter out soft-deleted records.
 * Handles both NULL (legacy rows) and false (new rows).
 * Use in metaList2 / metaGet2 xcCondition param.
 */
export const notDeletedXcCondition = {
  _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }],
};

/**
 * xcCondition: type = TABLE | VIEW (no deleted filter)
 */
export const modelOrViewXcCondition = {
  _or: [{ type: { eq: ModelTypes.TABLE } }, { type: { eq: ModelTypes.VIEW } }],
};

/**
 * xcCondition: type = TABLE | VIEW AND not deleted
 */
export const modelOrViewNotDeletedXcCondition = {
  _and: [modelOrViewXcCondition, notDeletedXcCondition],
};

/**
 * Knex where clause builder for excluding soft-deleted records.
 * Use with raw knex queries: `.where(notDeletedKnexCondition)`
 */
export function notDeletedKnexCondition(qb: any) {
  qb.where('deleted', false).orWhereNull('deleted');
}
