import type { NcContext } from 'nocodb-sdk';
import {
  CONTEXT_INFO_EXTRACT_COLUMN_ALIAS,
  CONTEXT_INFO_IS_CACHE_EXTRACT_COLUMN,
} from '~/constants';

export class CacheExtractColumnHelper {
  constructor(protected context: NcContext) {
    if (!this.context.additionalContext) {
      this.context.additionalContext = {};
    }
  }
  isEnabled() {
    return this.context.additionalContext[CONTEXT_INFO_IS_CACHE_EXTRACT_COLUMN];
  }
  setEnabled(value: boolean) {
    this.context.additionalContext[CONTEXT_INFO_IS_CACHE_EXTRACT_COLUMN] =
      value;
    if (
      value &&
      !this.context.additionalContext[CONTEXT_INFO_EXTRACT_COLUMN_ALIAS]
    ) {
      this.context.additionalContext[CONTEXT_INFO_EXTRACT_COLUMN_ALIAS] = {};
    }
    if (
      !this.context.additionalContext[CONTEXT_INFO_EXTRACT_COLUMN_ALIAS][
        this.context.base_id
      ]
    ) {
      this.context.additionalContext[CONTEXT_INFO_EXTRACT_COLUMN_ALIAS][
        this.context.base_id
      ] = {};
    }
  }
  isCacheGeneratedForModel(modelId: string) {
    if (!this.isEnabled()) {
      return false;
    }
    const modelCache =
      this.context.additionalContext[CONTEXT_INFO_EXTRACT_COLUMN_ALIAS][
        this.context.base_id
      ][modelId];
    const isGenerated = modelCache && Object.keys(modelCache).length > 0;
    if (
      !this.context.additionalContext[CONTEXT_INFO_EXTRACT_COLUMN_ALIAS][
        this.context.base_id
      ][modelId]
    ) {
      this.context.additionalContext[CONTEXT_INFO_EXTRACT_COLUMN_ALIAS][
        this.context.base_id
      ][modelId] = {};
    }
    return isGenerated;
  }
  getCacheForColumn(modelId: string, columnId: string) {
    if (!this.isEnabled()) {
      return undefined;
    }
    return this.context.additionalContext?.[CONTEXT_INFO_EXTRACT_COLUMN_ALIAS][
      this.context.base_id
    ][modelId]?.[columnId] as any;
  }
  setCacheForColumn(modelId: string, columnId: string, value: any) {
    if (!this.isEnabled()) {
      return undefined;
    }
    this.context.additionalContext[CONTEXT_INFO_EXTRACT_COLUMN_ALIAS][
      this.context.base_id
    ][modelId][columnId] = value;
  }
}
