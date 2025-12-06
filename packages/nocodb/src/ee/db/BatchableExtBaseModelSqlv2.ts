import { Logger } from '@nestjs/common';
import { NcApiVersion } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { NcContext } from '~/interface/config';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column } from '~/models';
import { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';

import { runExternal } from '~/helpers/muxHelpers';
import { FieldHandler } from '~/db/field-handler';

const logger = new Logger('BaseModelSqlv2');
function getQueryType(
  query: string,
): 'select' | 'insert' | 'update' | 'delete' | 'raw' {
  const trimmedQuery = query.trim().toLowerCase();
  if (trimmedQuery.startsWith('select')) {
    return 'select';
  } else if (trimmedQuery.startsWith('insert')) {
    return 'insert';
  } else if (trimmedQuery.startsWith('update')) {
    return 'update';
  } else if (trimmedQuery.startsWith('delete')) {
    return 'delete';
  }
  return 'raw';
}

/**
 * Base class for models
 *
 * @class
 * @classdesc Base class for models
 */
class BatchableExtBaseModelSqlv2 extends BaseModelSqlv2 {
  static fromBaseModel(
    baseModel: IBaseModelSqlV2,
    { trx }: { trx?: any } = {},
  ) {
    return new BatchableExtBaseModelSqlv2({
      context: baseModel.context,
      dbDriver: baseModel.dbDriver,
      viewId: baseModel.viewId,
      model: baseModel.model,
      schema: baseModel.schema,
      transaction: trx,
    });
  }

  public context: NcContext;

  constructor(param: any) {
    super(param);
  }

  protected batchMode: boolean = false;
  protected batchQueries: Array<{
    query: () => Promise<any>;
    queryString?: string; // Store query string for external sources
    type: 'insert' | 'update' | 'delete' | 'raw';
    resolve?: (value: any) => void; // Promise resolver for external sources
    reject?: (error: any) => void; // Promise rejecter for external sources
  }> = [];
  protected batchCallbacks: Array<() => Promise<void>> = [];
  /** Store original attachToTransaction functions to restore later */
  protected interceptedDrivers: Map<any, (fn: () => void) => void> = new Map();
  /** Store proxied drivers to restore later */
  protected proxiedDrivers: Map<any, any> = new Map();

  public beginBatchMode() {
    this.batchMode = true;
    this.batchQueries = [];
    this.batchCallbacks = [];
    this.interceptedDrivers.clear();
    this.proxiedDrivers.clear();

    // Store original drivers and wrap attachToTransaction
    const originalDbDriver = this._dbDriver;
    const originalActiveTransaction = this._activeTransaction;

    // Helper to wrap attachToTransaction on a driver
    const wrapAttachToTransaction = (driver: any) => {
      if (!driver || !driver.attachToTransaction) return;

      // Store original if not already wrapped
      if (!this.interceptedDrivers.has(driver)) {
        const original = driver.attachToTransaction;
        this.interceptedDrivers.set(driver, original);

        // Create a wrapper that checks batch mode
        const wrapped = (fn: () => void) => {
          if (this.batchMode) {
            // In batch mode, collect the callback
            this.batchCallbacks.push(async () => {
              try {
                await fn();
              } catch (error) {
                logger.error('Error in attached transaction callback:', error);
              }
            });
          } else {
            // Not in batch mode, call original
            return original.call(driver, fn);
          }
        };

        // Try to replace attachToTransaction
        // If it's read-only, we'll need to handle it differently
        try {
          // Try direct assignment first
          driver.attachToTransaction = wrapped;
        } catch (e) {
          // If direct assignment fails, try defineProperty
          try {
            Object.defineProperty(driver, 'attachToTransaction', {
              value: wrapped,
              writable: true,
              configurable: true,
              enumerable: true,
            });
          } catch (e2) {
            // If that also fails, we can't intercept it
            // Store the original and we'll handle it in endBatchMode
            logger.warn(
              'Could not wrap attachToTransaction, callbacks may not be batched',
            );
          }
        }
      }
    };

    // Wrap attachToTransaction on both drivers
    wrapAttachToTransaction(originalDbDriver);
    if (originalActiveTransaction) {
      wrapAttachToTransaction(originalActiveTransaction);
    }

    // Store for restoration
    (this as any).__originalDbDriver = originalDbDriver;
    (this as any).__originalActiveTransaction = originalActiveTransaction;
  }

  /**
   * endBatchMode handle external sources via runExternal
   * For external sources, queries are executed via runExternal instead of transactions
   */
  public async endBatchMode(): Promise<void> {
    if (!this.batchMode) {
      return;
    }

    // Check if this is an external source
    const isExternal = (this.dbDriver as any)?.isExternal === true;
    const extDb = isExternal ? (this.dbDriver as any)?.extDb : null;

    // For external sources, collect query strings and execute via runExternal
    try {
      // Collect all query strings from batch queries
      const queryStrings: string[] = [];
      const queriesWithStrings: typeof this.batchQueries = [];

      for (const batchQuery of this.batchQueries) {
        if (batchQuery.queryString) {
          // Use stored query string if available
          queryStrings.push(this.sanitizeQuery(batchQuery.queryString));
          queriesWithStrings.push(batchQuery);
        } else {
          // If query string not stored for external source, this is an error
          // For external sources, all queries should have query strings stored
          // This shouldn't happen, but if it does, we need to handle it
          // The query function will use execAndGetRows which doesn't work for external sources
          // So we should reject the promise or throw an error
          if (batchQuery.reject) {
            batchQuery.reject(
              new Error(
                'Query string not stored for external source batch query',
              ),
            );
          }
        }
      }

      // Execute all queries with strings via runExternal in one batch
      if (queryStrings.length > 0) {
        try {
          const results = await runExternal(queryStrings, extDb);
          // Resolve promises directly with results from runExternal
          // This avoids duplicate execution - we don't call batchQuery.query() again
          const resultsArray = Array.isArray(results) ? results : [results];

          for (let i = 0; i < queriesWithStrings.length; i++) {
            const batchQuery = queriesWithStrings[i];
            const result = resultsArray[i] ?? resultsArray[0]; // Use corresponding result or first if mismatch

            if (batchQuery.resolve) {
              // Resolve promise directly with result from runExternal
              batchQuery.resolve(result);
            } else {
              // Fallback: execute query function if resolver not available
              // This shouldn't happen, but handle it gracefully
              await batchQuery.query();
            }
          }
        } catch (error) {
          // Reject all promises if runExternal fails
          for (const batchQuery of queriesWithStrings) {
            if (batchQuery.reject) {
              batchQuery.reject(error);
            }
          }
          throw error;
        }
      }
    } catch (e) {
      throw e;
    }

    // Execute all callbacks after queries complete (for both external and non-external)
    for (const callback of this.batchCallbacks) {
      await callback();
    }

    // Cleanup
    try {
      // Restore original dbDriver getter
      if ((this as any).__originalDbDriver !== undefined) {
        try {
          Object.defineProperty(this, 'dbDriver', {
            get: () => {
              return this._activeTransaction || this._dbDriver;
            },
            configurable: true,
            enumerable: true,
          });
        } catch (e) {
          // logger.warn('Could not restore dbDriver getter', e);
        }
        // Clean up stored references
        delete (this as any).__originalDbDriver;
        delete (this as any).__originalActiveTransaction;
        delete (this as any).__proxiedBaseDriver;
        delete (this as any).__proxiedTransaction;
      }

      this.interceptedDrivers.clear();
      this.proxiedDrivers.clear();

      this.batchMode = false;
      this.batchQueries = [];
      this.batchCallbacks = [];
    } catch (e) {
      // Cleanup error - log but don't throw
    }
  }

  public async execAndParse(
    qb: Knex.QueryBuilder | string,
    dependencyColumns?: Column[],
    options: {
      skipDateConversion?: boolean;
      skipAttachmentConversion?: boolean;
      skipSubstitutingColumnIds?: boolean;
      skipUserConversion?: boolean;
      skipJsonConversion?: boolean;
      raw?: boolean; // alias for skipDateConversion and skipAttachmentConversion
      first?: boolean;
      bulkAggregate?: boolean;
      apiVersion?: NcApiVersion;
    } = {
      skipDateConversion: false,
      skipAttachmentConversion: false,
      skipSubstitutingColumnIds: false,
      skipUserConversion: false,
      skipJsonConversion: false,
      raw: false,
      first: false,
      bulkAggregate: false,
      apiVersion: NcApiVersion.V2,
    },
  ) {
    if (options.raw) {
      options.skipDateConversion = true;
      options.skipAttachmentConversion = true;
      options.skipSubstitutingColumnIds = true;
      options.skipUserConversion = true;
      options.skipJsonConversion = true;
    }

    if (typeof qb !== 'string') {
      this.knex.applyCte(qb);
    }

    if (options.first && typeof qb !== 'string') {
      qb = qb.limit(1);
    }

    const query = typeof qb === 'string' ? qb : qb.toQuery();

    // Determine query type for batching
    const queryType = getQueryType(query);

    // If in batch mode and this is a write query (insert/update/delete), batch it
    // Read queries (SELECT) should still execute immediately for validation
    const shouldBatch = this.batchMode && queryType !== 'select';

    let data;
    if (shouldBatch) {
      // Queue the query for batch execution
      // Store the query string - dbDriver will use active transaction when executed
      const queryStr = query;
      data = await this.executeBatchableQuery(
        async () => {
          // This won't be called for external sources in batch mode
          // as endBatchMode resolves promises directly with runExternal results
          return await runExternal(
            this.sanitizeQuery(queryStr),
            (this.dbDriver as any).extDb,
          );
        },
        queryType as 'insert' | 'update' | 'delete' | 'raw',
        queryStr,
      );
    } else {
      // Not in batch mode, execute immediately with runExternal
      data = await runExternal(
        this.sanitizeQuery(query),
        (this.dbDriver as any).extDb,
      );
    }

    if (!this.model?.columns) {
      await this.model.getColumns(this.context);
    }

    // update attachment fields
    if (!options.skipAttachmentConversion) {
      data = await this.convertAttachmentType(data, dependencyColumns);
    }

    // update date time fields
    if (!options.skipDateConversion) {
      data = this.convertDateFormat(data, dependencyColumns);
    }

    // update user fields
    if (!options.skipUserConversion) {
      data = await this.convertUserFormat(
        data,
        dependencyColumns,
        options?.apiVersion,
      );
    }

    if (!options.skipJsonConversion) {
      data = await this.convertJsonTypes(data, dependencyColumns);
    }
    if (options.apiVersion === NcApiVersion.V3) {
      data = await this.convertMultiSelectTypes(data, dependencyColumns);
      await FieldHandler.fromBaseModel(this).parseDataDbValue({
        data,
        options: {
          additionalColumns: dependencyColumns,
        },
      });
    }

    if (!options.skipSubstitutingColumnIds) {
      data = await this.substituteColumnIdsWithColumnTitles(
        data,
        dependencyColumns,
      );
    }

    if (options.first) {
      return data?.[0];
    }

    return data;
  }

  /**
   * Adds a query to the batch queue if in batch mode, otherwise executes immediately
   * The query function should use this.dbDriver which will use the active transaction
   * @param queryString Optional query string for external sources to batch execute
   */
  protected async executeBatchableQuery<T>(
    queryFn: () => Promise<T>,
    type: 'insert' | 'update' | 'delete' | 'raw' = 'raw',
    queryString?: string,
  ): Promise<T> {
    if (this.batchMode) {
      // In batch mode, queue the query and return immediately
      // The actual execution will happen in endBatchMode
      // We return immediately to avoid blocking - the caller doesn't need the result yet
      let resolve: (value: T) => void;
      let reject: (error: any) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });

      // Store the query function - it will execute later with the transaction context
      // The queryFn should use this.dbDriver which will pick up the active transaction
      // Also store query string and promise resolvers for external sources
      this.batchQueries.push({
        query: async () => {
          try {
            // Ensure we use the dbDriver which will use active transaction if set
            const result = await queryFn();
            // Only resolve if not already resolved (for write operations resolved immediately)
            // Resolving a promise multiple times is safe, but we avoid it for clarity
            if (type !== 'insert' && type !== 'update' && type !== 'delete') {
              resolve(result as T);
            }
            return result;
          } catch (error) {
            // Always reject on error, even if already resolved
            reject(error);
            throw error;
          }
        },
        queryString,
        type,
        resolve: resolve as (value: any) => void, // Store resolver for external sources
        reject: reject as (error: any) => void, // Store rejecter for external sources
      });

      // Return the promise - it will be resolved when the query executes in endBatchMode
      // For write operations (insert/update/delete), the caller typically doesn't need the result
      // so we resolve immediately with undefined to avoid blocking
      // The actual execution will happen in endBatchMode, but we don't need to wait for it here
      if (type === 'insert' || type === 'update' || type === 'delete') {
        // For write operations, resolve immediately with undefined since the result isn't needed
        // The actual execution will happen in endBatchMode
        // Note: Resolving a promise multiple times is safe (subsequent resolves are ignored)
        resolve(undefined as T);
      }
      // Return the promise - it will be resolved when the query executes in endBatchMode
      // For raw queries, the promise will resolve in endBatchMode
      return promise;
    } else {
      return await queryFn();
    }
  }
}

export { BatchableExtBaseModelSqlv2 };
