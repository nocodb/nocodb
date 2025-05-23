import Knex from 'knex'
import ClientPgLite from 'knex-pglite'
import type { z } from 'zod'
import {
  ncBaseUsersV2Schema,
  ncBasesV2Schema,
  ncCalendarViewColumnsV2Schema,
  ncCalendarViewRangeV2Schema,
  ncCalendarViewV2Schema,
  ncColBarcodeV2Schema,
  ncColButtonV2Schema,
  ncColFormulaV2Schema,
  ncColLongTextV2Schema,
  ncColLookupV2Schema,
  ncColQrcodeV2Schema,
  ncColRelationsV2Schema,
  ncColRollupV2Schema,
  ncColSelectOptionsV2Schema,
  ncColumnsV2Schema,
  ncDisabledModelsForRoleV2Schema,
  ncExtensionsSchema,
  ncFilterExpV2Schema,
  ncFormViewColumnsV2Schema,
  ncFormViewV2Schema,
  ncGalleryViewColumnsV2Schema,
  ncGalleryViewV2Schema,
  ncGridViewColumnsV2Schema,
  ncGridViewV2Schema,
  ncHooksV2Schema,
  ncJobsSchema,
  ncKanbanViewColumnsV2Schema,
  ncKanbanViewV2Schema,
  ncMapViewColumnsV2Schema,
  ncMapViewV2Schema,
  ncModelsV2Schema,
  ncSortV2Schema,
  ncSourcesV2Schema,
  ncSyncConfigsSchema,
  ncViewsV2Schema,
  syncMetadataSchema,
} from './schema'
import { MetaTable } from '.'
import MigrationSource from '~/db/MigrationSource'
import { CustomMigrator } from '~/db/CustomMigrator'
import { RealtimeEventType } from '~/plugins/socket'

// Maximum number of retries for database operations
const MAX_DB_RETRIES = 3
// Delay between retries with exponential backoff (ms)
const getRetryDelay = (attempt: number) => Math.min(500 * 2 ** attempt, 5000)

// Configure IndexedDB connection
const instance = Knex({
  client: ClientPgLite,
  dialect: 'postgres',
  connection: { connectionString: 'idb://nocodb' },
  useNullAsDefault: true,
})

// Table to Zod schema mapping for validation
const TABLE_SCHEMAS: { [key: string]: z.ZodSchema } = {
  [MetaTable.PROJECT]: ncBasesV2Schema,
  [MetaTable.SOURCES]: ncSourcesV2Schema,
  [MetaTable.MODELS]: ncModelsV2Schema,
  [MetaTable.COLUMNS]: ncColumnsV2Schema,
  [MetaTable.COL_RELATIONS]: ncColRelationsV2Schema,
  [MetaTable.COL_SELECT_OPTIONS]: ncColSelectOptionsV2Schema,
  [MetaTable.COL_LOOKUP]: ncColLookupV2Schema,
  [MetaTable.COL_ROLLUP]: ncColRollupV2Schema,
  [MetaTable.COL_FORMULA]: ncColFormulaV2Schema,
  [MetaTable.COL_QRCODE]: ncColQrcodeV2Schema,
  [MetaTable.COL_BARCODE]: ncColBarcodeV2Schema,
  [MetaTable.COL_LONG_TEXT]: ncColLongTextV2Schema,
  [MetaTable.FILTER_EXP]: ncFilterExpV2Schema,
  [MetaTable.SORT]: ncSortV2Schema,
  [MetaTable.FORM_VIEW]: ncFormViewV2Schema,
  [MetaTable.FORM_VIEW_COLUMNS]: ncFormViewColumnsV2Schema,
  [MetaTable.GALLERY_VIEW]: ncGalleryViewV2Schema,
  [MetaTable.GALLERY_VIEW_COLUMNS]: ncGalleryViewColumnsV2Schema,
  [MetaTable.CALENDAR_VIEW]: ncCalendarViewV2Schema,
  [MetaTable.CALENDAR_VIEW_COLUMNS]: ncCalendarViewColumnsV2Schema,
  [MetaTable.CALENDAR_VIEW_RANGE]: ncCalendarViewRangeV2Schema,
  [MetaTable.GRID_VIEW]: ncGridViewV2Schema,
  [MetaTable.GRID_VIEW_COLUMNS]: ncGridViewColumnsV2Schema,
  [MetaTable.KANBAN_VIEW]: ncKanbanViewV2Schema,
  [MetaTable.KANBAN_VIEW_COLUMNS]: ncKanbanViewColumnsV2Schema,
  [MetaTable.VIEWS]: ncViewsV2Schema,
  [MetaTable.HOOKS]: ncHooksV2Schema,
  [MetaTable.PROJECT_USERS]: ncBaseUsersV2Schema,
  [MetaTable.MODEL_ROLE_VISIBILITY]: ncDisabledModelsForRoleV2Schema,
  [MetaTable.MAP_VIEW]: ncMapViewV2Schema,
  [MetaTable.MAP_VIEW_COLUMNS]: ncMapViewColumnsV2Schema,
  [MetaTable.EXTENSIONS]: ncExtensionsSchema,
  [MetaTable.JOBS]: ncJobsSchema,
  [MetaTable.COL_BUTTON]: ncColButtonV2Schema,
  [MetaTable.SYNC_CONFIGS]: ncSyncConfigsSchema,
  sync_metadata: syncMetadataSchema,
}

// Tables that need to be synchronized with the backend
export const SyncTables = {
  PROJECT: 'nc_bases_v2',
  SOURCES: 'nc_sources_v2',
  MODELS: 'nc_models_v2',
  COLUMNS: 'nc_columns_v2',
  COL_RELATIONS: 'nc_col_relations_v2',
  COL_SELECT_OPTIONS: 'nc_col_select_options_v2',
  COL_LOOKUP: 'nc_col_lookup_v2',
  COL_ROLLUP: 'nc_col_rollup_v2',
  COL_FORMULA: 'nc_col_formula_v2',
  COL_QRCODE: 'nc_col_qrcode_v2',
  COL_BARCODE: 'nc_col_barcode_v2',
  COL_LONG_TEXT: 'nc_col_long_text_v2',
  FILTER_EXP: 'nc_filter_exp_v2',
  SORT: 'nc_sort_v2',
  FORM_VIEW: 'nc_form_view_v2',
  FORM_VIEW_COLUMNS: 'nc_form_view_columns_v2',
  GALLERY_VIEW: 'nc_gallery_view_v2',
  GALLERY_VIEW_COLUMNS: 'nc_gallery_view_columns_v2',
  CALENDAR_VIEW: 'nc_calendar_view_v2',
  CALENDAR_VIEW_COLUMNS: 'nc_calendar_view_columns_v2',
  CALENDAR_VIEW_RANGE: 'nc_calendar_view_range_v2',
  GRID_VIEW: 'nc_grid_view_v2',
  GRID_VIEW_COLUMNS: 'nc_grid_view_columns_v2',
  KANBAN_VIEW: 'nc_kanban_view_v2',
  KANBAN_VIEW_COLUMNS: 'nc_kanban_view_columns_v2',
  VIEWS: 'nc_views_v2',
  HOOKS: 'nc_hooks_v2',
  PROJECT_USERS: 'nc_base_users_v2',
  MODEL_ROLE_VISIBILITY: 'nc_disabled_models_for_role_v2',
  MAP_VIEW: 'nc_map_view_v2',
  MAP_VIEW_COLUMNS: 'nc_map_view_columns_v2',
  EXTENSIONS: 'nc_extensions',
  JOBS: 'nc_jobs',
  COL_BUTTON: 'nc_col_button_v2',
  SYNC_CONFIGS: 'nc_sync_configs',
}

// Define consistent error types for better error handling
export enum MetadataErrorType {
  SCHEMA_INIT_FAILED = 'SCHEMA_INIT_FAILED',
  BOOTSTRAP_FAILED = 'BOOTSTRAP_FAILED',
  APPLY_EVENT_FAILED = 'APPLY_EVENT_FAILED',
  SYNC_FAILED = 'SYNC_FAILED',
  UNKNOWN_TABLE = 'UNKNOWN_TABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export class MetadataError extends Error {
  type: MetadataErrorType
  details?: any

  constructor(type: MetadataErrorType, message: string, details?: any) {
    super(message)
    this.name = 'MetadataError'
    this.type = type
    this.details = details
  }
}

// Stats tracking for debugging and performance monitoring
interface MetadataStats {
  bootstrapCount: number
  lastBootstrapTime: number | null
  eventCount: {
    insert: number
    update: number
    delete: number
    total: number
  }
  errors: {
    bootstrapErrors: number
    eventErrors: number
    syncErrors: number
    lastError: string | null
  }
  lastSyncTime: number | null
}

export class MetadataManager {
  private isInitialized = false
  private initPromise: Promise<void> | null = null
  private stats: MetadataStats = {
    bootstrapCount: 0,
    lastBootstrapTime: null,
    eventCount: {
      insert: 0,
      update: 0,
      delete: 0,
      total: 0,
    },
    errors: {
      bootstrapErrors: 0,
      eventErrors: 0,
      syncErrors: 0,
      lastError: null,
    },
    lastSyncTime: null,
  }

  constructor() {
    this.initPromise = this.initSchema()
  }

  /**
   * Initialize the database schema
   * @returns Promise that resolves when schema is initialized
   */
  async initSchema(): Promise<void> {
    if (this.isInitialized) return

    try {
      const migrator = new CustomMigrator(instance, new MigrationSource(), 'xc_migrations')
      await migrator.latest()
      this.isInitialized = true
    } catch (err) {
      console.error('Schema initialization failed:', err)
      this.stats.errors.lastError = err.message
      throw new MetadataError(MetadataErrorType.SCHEMA_INIT_FAILED, 'Failed to initialize database schema', err)
    }
  }

  /**
   * Get database statistics
   */
  getStats(): MetadataStats {
    return { ...this.stats }
  }

  /**
   * Reset error statistics
   */
  resetErrorStats(): void {
    this.stats.errors = {
      bootstrapErrors: 0,
      eventErrors: 0,
      syncErrors: 0,
      lastError: null,
    }
  }

  /**
   * Execute a database operation with retries
   * @param operation Function that returns a promise
   * @param errorType Error type to throw if all retries fail
   * @param errorMessage Error message to use if all retries fail
   */
  private async withRetry<T>(operation: () => Promise<T>, errorType: MetadataErrorType, errorMessage: string): Promise<T> {
    let lastError: any

    for (let attempt = 0; attempt < MAX_DB_RETRIES; attempt++) {
      try {
        return await operation()
      } catch (err) {
        lastError = err
        console.warn(`Database operation failed (attempt ${attempt + 1}/${MAX_DB_RETRIES}):`, err)

        if (attempt < MAX_DB_RETRIES - 1) {
          // Wait before retrying with exponential backoff
          await new Promise((resolve) => setTimeout(resolve, getRetryDelay(attempt)))
        }
      }
    }

    this.stats.errors.lastError = lastError.message
    throw new MetadataError(errorType, errorMessage, lastError)
  }

  /**
   * Sanitize record values to ensure compatibility with IndexedDB
   * @param record Record to sanitize
   */
  private sanitizeRecord(record: any): any {
    if (!record || typeof record !== 'object') return record

    const sanitized = { ...record }

    // Convert various data types correctly
    for (const [key, value] of Object.entries(sanitized)) {
      // Handle boolean fields
      if (
        key === 'deleted' ||
        key === 'is_meta' ||
        key === 'enabled' ||
        key === 'pk' ||
        key === 'pv' ||
        key === 'rqd' ||
        key === 'un' ||
        key === 'ai' ||
        key === 'unique' ||
        key === 'system' ||
        key === 'readonly' ||
        key === 'virtual' ||
        key === 'au' ||
        key === 'show' ||
        key === 'is_default' ||
        key === 'mm' ||
        key === 'synced' ||
        key === 'is_group' ||
        key === 'required' ||
        key === 'pinned' ||
        key === 'starred' ||
        key === 'hidden' ||
        key === 'is_data_readonly' ||
        key === 'is_schema_readonly' ||
        key === 'is_local' ||
        key === 'is_encrypted'
      ) {
        // Convert numeric booleans (0/1)
        if (value === 0 || value === '0') {
          sanitized[key] = false
        } else if (value === 1 || value === '1') {
          sanitized[key] = true
        }
        // Convert string booleans
        else if (value === 'true') {
          sanitized[key] = true
        } else if (value === 'false') {
          sanitized[key] = false
        }
      }

      // Handle null values
      else if (value === 'null' || value === 'undefined') {
        sanitized[key] = null
      }

      // Handle numeric fields
      else if (
        typeof value === 'string' &&
        !isNaN(Number(value)) &&
        (key === 'order' ||
          key === 'cover_image_idx' ||
          key === 'type' ||
          key === 'retries' ||
          key === 'retry_interval' ||
          key === 'timeout' ||
          key === 'row_height' ||
          key === 'group_by_order')
      ) {
        sanitized[key] = Number(value)
      }
    }

    return sanitized
  }

  /**
   * Load all metadata for a base from the server and store it locally
   * @param workspace_id Workspace ID
   * @param base_id Base ID
   */
  async bootstrap(workspace_id: string, base_id: string): Promise<void> {
    // Make sure schema is initialized first
    if (!this.isInitialized) {
      await this.initPromise
    }

    try {
      const startTime = Date.now()
      const { $api } = useNuxtApp()

      // Fetch all metadata from server
      const res = await $api.base.bootstrap(base_id)
      if (!Array.isArray(res)) {
        throw new MetadataError(MetadataErrorType.BOOTSTRAP_FAILED, 'Invalid response from bootstrap API', { response: res })
      }

      // Process each table's data in a transaction
      await instance.transaction(async (trx) => {
        for (const table of Object.values(SyncTables)) {
          if (table === 'sync_metadata') continue

          // Find records for this table
          const tableRecords = res.filter((r: any) => r.table === table)

          // Handle base table specially to avoid duplicate key errors
          if (table === 'nc_bases_v2') {
            // Check if the base already exists
            const existingBase = await trx(table).where({ id: base_id }).first()
            if (existingBase) {
              // Update the existing base instead of inserting
              console.log(`Base ${base_id} already exists, will update instead of insert`)
              continue
            }
          } else {
            // For all other tables, clear existing data for this base
            await trx(table).where({ base_id }).delete()
          }

          // Insert records in batches
          if (tableRecords?.[0]?.records?.length > 0) {
            // Get records and ensure proper type conversion
            let records = tableRecords[0].records

            // Define all boolean fields we need to check
            const booleanFields = [
              'deleted',
              'is_meta',
              'enabled',
              'pk',
              'pv',
              'rqd',
              'un',
              'ai',
              'unique',
              'system',
              'readonly',
              'virtual',
              'au',
              'show',
              'is_default',
              'mm',
              'synced',
              'is_group',
              'required',
              'pinned',
              'starred',
              'hidden',
              'is_data_readonly',
              'is_schema_readonly',
              'is_local',
              'is_encrypted',
            ]

            // Convert types based on schema before insertion
            records = records.map((record) => {
              const converted = { ...record }

              // Convert all field types properly
              for (const [key, value] of Object.entries(converted)) {
                // Handle boolean fields
                if (booleanFields.includes(key)) {
                  if (value === 0 || value === '0' || value === false || value === 'false') {
                    converted[key] = false
                  } else if (value === 1 || value === '1' || value === true || value === 'true') {
                    converted[key] = true
                  }
                }

                // Handle null values
                else if (value === 'null' || value === 'undefined') {
                  converted[key] = null
                }

                // Handle numeric fields
                else if (
                  typeof value === 'string' &&
                  !isNaN(Number(value)) &&
                  (key === 'order' ||
                    key === 'cover_image_idx' ||
                    key === 'type' ||
                    key === 'retries' ||
                    key === 'retry_interval' ||
                    key === 'timeout' ||
                    key === 'row_height' ||
                    key === 'group_by_order')
                ) {
                  converted[key] = Number(value)
                }
              }

              // Special handling for specific tables
              if (table === 'nc_sources_v2') {
                ;['is_meta', 'enabled', 'deleted', 'is_schema_readonly', 'is_data_readonly', 'is_local', 'is_encrypted'].forEach(
                  (field) => {
                    if (converted[field] !== true && converted[field] !== false) {
                      converted[field] = !!converted[field]
                    }
                  },
                )
              } else if (table === 'nc_models_v2') {
                ;['enabled', 'mm', 'pinned', 'deleted', 'synced'].forEach((field) => {
                  if (converted[field] !== true && converted[field] !== false) {
                    converted[field] = !!converted[field]
                  }
                })
              }

              return converted
            })

            const batchSize = 500 // Smaller batch size for better performance

            try {
              for (let i = 0; i < records.length; i += batchSize) {
                const batch = records.slice(i, i + batchSize)
                await trx(table).insert(batch)
              }
            } catch (err) {
              console.error(`Error inserting records into ${table}:`, err.message)

              // Fall back to individual record insertion if we have a type issue
              if (
                err.message?.includes('Invalid input for boolean type') ||
                err.message?.includes('type') ||
                err.message?.includes('constraint')
              ) {
                console.warn(`Falling back to one-by-one insertion for ${table}`)

                for (const record of records) {
                  try {
                    // Apply additional type conversion for individual records
                    const convertedRecord = { ...record }

                    // Define all boolean fields we need to check
                    const booleanFields = [
                      'deleted',
                      'is_meta',
                      'enabled',
                      'pk',
                      'pv',
                      'rqd',
                      'un',
                      'ai',
                      'unique',
                      'system',
                      'readonly',
                      'virtual',
                      'au',
                      'show',
                      'is_default',
                      'mm',
                      'synced',
                      'is_group',
                      'required',
                      'pinned',
                      'starred',
                      'hidden',
                      'is_data_readonly',
                      'is_schema_readonly',
                      'is_local',
                      'is_encrypted',
                    ]

                    for (const [key, value] of Object.entries(convertedRecord)) {
                      // Handle numeric fields
                      if (
                        typeof value === 'string' &&
                        !isNaN(Number(value)) &&
                        (key === 'order' || key === 'cover_image_idx' || key === 'type' || key === 'retries')
                      ) {
                        convertedRecord[key] = Number(value)
                      }

                      // Force convert boolean fields for specific tables
                      if (booleanFields.includes(key)) {
                        if (value === 0 || value === '0' || value === false || value === 'false') {
                          convertedRecord[key] = false
                        } else if (value === 1 || value === '1' || value === true || value === 'true') {
                          convertedRecord[key] = true
                        }
                      }
                    }

                    // Special handling for specific tables
                    if (table === 'nc_sources_v2') {
                      ;[
                        'is_meta',
                        'enabled',
                        'deleted',
                        'is_schema_readonly',
                        'is_data_readonly',
                        'is_local',
                        'is_encrypted',
                      ].forEach((field) => {
                        if (convertedRecord[field] !== true && convertedRecord[field] !== false) {
                          convertedRecord[field] = !!convertedRecord[field]
                        }
                      })
                    } else if (table === 'nc_models_v2') {
                      ;['enabled', 'mm', 'pinned', 'deleted', 'synced'].forEach((field) => {
                        if (convertedRecord[field] !== true && convertedRecord[field] !== false) {
                          convertedRecord[field] = !!convertedRecord[field]
                        }
                      })
                    }

                    await trx(table).insert(convertedRecord)
                  } catch (insertErr) {
                    console.error(`Failed to insert record into ${table}:`, insertErr.message)
                    // Continue with other records
                  }
                }
              } else {
                // Re-throw other errors
                throw err
              }
            }
          }
        }

        // Update sync metadata
        await trx('sync_metadata')
          .insert({
            workspace_id,
            base_id,
            last_sync_timestamp: new Date().toISOString(),
          })
          .onConflict(['workspace_id', 'base_id'])
          .merge()
      })

      // Update stats
      this.stats.bootstrapCount++
      this.stats.lastBootstrapTime = Date.now()
      this.stats.lastSyncTime = Date.now()
      console.log(`Bootstrap completed in ${Date.now() - startTime}ms for base ${base_id}`)
    } catch (err) {
      console.error('Bootstrap failed:', err)
      this.stats.errors.bootstrapErrors++
      this.stats.errors.lastError = err.message

      // Try to determine the error type
      if (err instanceof MetadataError) {
        throw err
      } else if (err.message?.includes('network') || err.name === 'AbortError') {
        throw new MetadataError(
          MetadataErrorType.NETWORK_ERROR,
          'Network error during bootstrap. Please check your connection.',
          err,
        )
      } else {
        throw new MetadataError(MetadataErrorType.BOOTSTRAP_FAILED, 'Failed to bootstrap metadata', err)
      }
    }
  }

  /**
   * Apply a single realtime event to the local database
   * @param event Realtime event to apply
   */
  async applyEvent(event: {
    type: string
    data: { target: MetaTable; payload: any; eventId?: string; workspace_id?: string; base_id?: string }
  }): Promise<void> {
    // Make sure schema is initialized first
    if (!this.isInitialized) {
      await this.initPromise
    }

    try {
      const { type, data } = event
      const { target, payload, eventId, workspace_id = 'nc', base_id } = data

      // Skip if missing required data
      if (!target || !payload || !base_id) {
        console.warn('Skipping event with missing data:', event)
        return
      }

      // Validate the target table exists
      if (!TABLE_SCHEMAS[target]) {
        throw new MetadataError(MetadataErrorType.UNKNOWN_TABLE, `Unknown or unsupported metadata table: ${target}`, { target })
      }

      // Apply the event based on its type
      if (type === RealtimeEventType.META_INSERT) {
        await this.withRetry(
          async () => {
            // Sanitize the payload with improved type conversion
            const sanitizedPayload = this.sanitizeRecord(payload)

            try {
              await instance(target).insert(sanitizedPayload)
            } catch (err) {
              // If insert fails due to type issues, try manual type conversion
              if (err.message?.includes('type') || err.message?.includes('constraint')) {
                // Special handling for numeric and boolean fields
                const manuallyConverted = { ...sanitizedPayload }

                // Ensure types match schema expectations for specific tables
                if (target === MetaTable.VIEWS) {
                  if (typeof manuallyConverted.type === 'string') {
                    manuallyConverted.type = parseInt(manuallyConverted.type, 10)
                  }
                }

                await instance(target).insert(manuallyConverted)
              } else {
                throw err
              }
            }

            this.stats.eventCount.insert++
          },
          MetadataErrorType.APPLY_EVENT_FAILED,
          `Failed to insert data into ${target}`,
        )
      } else if (type === RealtimeEventType.META_UPDATE) {
        await this.withRetry(
          async () => {
            // Sanitize the payload with improved type conversion
            const sanitizedPayload = this.sanitizeRecord(payload)

            // Handle special case for project users
            const primaryKey =
              target === MetaTable.PROJECT_USERS
                ? { base_id, fk_user_id: sanitizedPayload.fk_user_id }
                : { id: sanitizedPayload.id }

            try {
              const result = await instance(target)
                .where({ ...primaryKey, base_id })
                .update(sanitizedPayload)

              // If no rows were affected, this might be an upsert situation
              if (result === 0) {
                // Check if the record exists
                const exists = await instance(target).where(primaryKey).first()

                // If it doesn't exist, insert it instead
                if (!exists) {
                  await instance(target).insert({
                    ...sanitizedPayload,
                    base_id,
                  })
                }
              }
            } catch (err) {
              // If update fails due to type issues, try manual type conversion
              if (err.message?.includes('type') || err.message?.includes('constraint')) {
                // Special handling for numeric and boolean fields
                const manuallyConverted = { ...sanitizedPayload }

                // Ensure types match schema expectations for specific tables
                if (target === MetaTable.VIEWS) {
                  if (typeof manuallyConverted.type === 'string') {
                    manuallyConverted.type = parseInt(manuallyConverted.type, 10)
                  }
                }

                await instance(target)
                  .where({ ...primaryKey, base_id })
                  .update(manuallyConverted)
              } else {
                throw err
              }
            }

            this.stats.eventCount.update++
          },
          MetadataErrorType.APPLY_EVENT_FAILED,
          `Failed to update data in ${target}`,
        )
      } else if (type === RealtimeEventType.META_DELETE) {
        await this.withRetry(
          async () => {
            const primaryKey =
              target === MetaTable.PROJECT_USERS ? { base_id, fk_user_id: payload.fk_user_id } : { id: payload.id }

            await instance(target)
              .where({ ...primaryKey, base_id })
              .delete()

            this.stats.eventCount.delete++
          },
          MetadataErrorType.APPLY_EVENT_FAILED,
          `Failed to delete data from ${target}`,
        )
      }

      // Update sync metadata if we have an event ID
      if (eventId) {
        await this.withRetry(
          async () => {
            await instance('sync_metadata')
              .insert({
                workspace_id,
                base_id,
                last_event_id: eventId,
                last_sync_timestamp: new Date().toISOString(),
              })
              .onConflict(['workspace_id', 'base_id'])
              .merge()
          },
          MetadataErrorType.APPLY_EVENT_FAILED,
          'Failed to update sync metadata',
        )
      }

      // Update overall stats
      this.stats.eventCount.total++
      this.stats.lastSyncTime = Date.now()
    } catch (err) {
      console.error('Apply event failed:', err)
      this.stats.errors.eventErrors++
      this.stats.errors.lastError = err.message

      // Rethrow the error with proper type
      if (err instanceof MetadataError) {
        throw err
      } else {
        throw new MetadataError(MetadataErrorType.APPLY_EVENT_FAILED, 'Failed to apply realtime event', err)
      }
    }
  }

  /**
   * Synchronize missed events from the server
   * @param workspace_id Workspace ID
   * @param base_id Base ID
   * @param offset Offset for pagination
   * @param limit Limit for pagination
   */
  async syncMissedEvents(workspace_id: string, base_id: string, offset = 0, limit = 500): Promise<number> {
    // Make sure schema is initialized first
    if (!this.isInitialized) {
      await this.initPromise
    }

    try {
      // Check if the base exists
      const baseExists = await instance('nc_bases_v2').where({ id: base_id }).first()

      // Get the last synchronized event ID
      const syncData = await instance('sync_metadata').where({ workspace_id, base_id }).first()

      // If the base doesn't exist or there's no sync data, we need to bootstrap
      if (!baseExists || !syncData?.last_event_id) {
        try {
          await this.bootstrap(workspace_id, base_id)
          return 0
        } catch (bootstrapErr) {
          console.error('Failed to bootstrap during syncMissedEvents:', bootstrapErr)
          // If bootstrap fails and it's because of a duplicate key, the base might already exist
          // Just continue with sync using empty event ID
          if (!bootstrapErr.message?.includes('duplicate key') && !baseExists) {
            throw bootstrapErr
          }
        }
      }

      // Get API client
      const { $api } = useNuxtApp()
      if (!$api) {
        throw new MetadataError(MetadataErrorType.SYNC_FAILED, 'API client not available', null)
      }

      console.log('Calling syncEvents API with params:', {
        workspace_id,
        base_id,
        since: syncData?.last_event_id,
        sinceType: 'event_id',
        offset,
        limit,
      });
      
      // Use the API client to fetch missed events
      const events = await $api.base.syncEvents({
        workspace_id,
        base_id,
        since: syncData?.last_event_id,
        sinceType: 'event_id',
        offset,
        limit,
      })
      if (!Array.isArray(events)) {
        throw new MetadataError(MetadataErrorType.SYNC_FAILED, 'Invalid response format for missed events', { response: events })
      }

      console.log(`Received ${events.length} events for syncing`);
      
      // Process events in a transaction for consistency
      await instance.transaction(async (trx) => {
        for (const event of events) {
          // Handle different payload formats
          let payload = event.payload;
          if (typeof event.payload === 'string') {
            try {
              payload = JSON.parse(event.payload);
            } catch (e) {
              console.warn(`Failed to parse event payload: ${e.message}`);
            }
          }
          
          await this.applyEvent({
            type: `META_${event.operation}`,
            data: {
              target: event.target as MetaTable,
              payload,
              eventId: event.id,
              workspace_id,
              base_id,
            },
          })
        }
        
        // Update sync metadata with the latest event ID if we processed any events
        if (events.length > 0) {
          const lastEvent = events[events.length - 1];
          await trx('sync_metadata')
            .insert({
              workspace_id,
              base_id,
              last_event_id: lastEvent.id,
              last_sync_timestamp: new Date().toISOString(),
            })
            .onConflict(['workspace_id', 'base_id'])
            .merge();
        }
      })

      // If we received the maximum number of events, there might be more
      if (events.length === limit) {
        // Recursively fetch more events
        const moreEvents = await this.syncMissedEvents(workspace_id, base_id, offset + limit, limit)
        return events.length + moreEvents
      }

      return events.length
    } catch (err) {
      console.error('Sync missed events failed:', err)
      this.stats.errors.syncErrors++
      this.stats.errors.lastError = err.message

      // Rethrow with proper error type
      if (err instanceof MetadataError) {
        throw err
      } else if (err.name === 'AbortError' || err.message?.includes('network')) {
        throw new MetadataError(MetadataErrorType.NETWORK_ERROR, 'Network error during sync. Please check your connection.', err)
      } else {
        throw new MetadataError(MetadataErrorType.SYNC_FAILED, 'Failed to sync missed events', err)
      }
    }
  }

  /**
   * Clear all data for a specific base
   * @param base_id Base ID to clear data for
   */
  async clearBaseData(base_id: string): Promise<void> {
    // Make sure schema is initialized first
    if (!this.isInitialized) {
      await this.initPromise
    }

    try {
      await instance.transaction(async (trx) => {
        for (const table of Object.values(SyncTables)) {
          if (table === 'sync_metadata') continue
          if (table === MetaTable.PROJECT) continue // Don't delete the base record

          await trx(table).where({ base_id }).delete()
        }

        // Remove sync metadata
        await trx('sync_metadata').where({ base_id }).delete()
      })

      console.log(`Cleared all data for base ${base_id}`)
    } catch (err) {
      console.error('Failed to clear base data:', err)
      throw new MetadataError(MetadataErrorType.DATABASE_ERROR, 'Failed to clear base data', err)
    }
  }

  /**
   * Get the Knex instance for direct database access
   * @returns Knex instance
   */
  getKnex(): Knex.Knex {
    return instance
  }
}

// Create and export a singleton instance
export const metadataManager = new MetadataManager()
