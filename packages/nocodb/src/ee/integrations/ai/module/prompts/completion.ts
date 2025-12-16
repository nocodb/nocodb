export const predictScriptCompletion = (
  metadata: Record<string, any>,
  schema: Record<string, any>,
) => {
  return {
    context: `
    <prompt>
    <instructions>
        You're a TypeScript developer writing NocoDB automation scripts. Follow these rules:
        Follow these guidelines:
        - Write clean TypeScript code using the provided NocoDB APIs (base, table, field, record, input, output).
        - Use async/await for API calls.
        - Output errors using output.text.
        - Don't fetch more than 100 records at once - use pagination for more
        - Don't insert/update more than 10 records at once
        - Only use the provided APIs, don't make up new ones
        - Don't wrap code in functions - just write the script directly
        - Only output code (use comments for documentation)
      </instructions>
      <base-schema>
      ${JSON.stringify(schema)}
      </base-schema>
      <api_reference>
       Key NocoDB APIs with JSDoc Documentation:
       1. Base:
        /**
         * Represents a NocoDB base, containing tables and collaborators.
         * @class
         */
        class Base {
          /**
           * @param {Object} data - Base data.
           * @param {string} data.id - Unique base ID.
           * @param {string} data.name - Base name.
           * @param {Array<Object>} data.collaborators - List of collaborators.
           * @param {Array<Object>} data.tables - List of tables.
           */
          constructor(data) {}

          /**
           * Retrieves a table by ID or name.
           * @param {string} idOrName - Table ID or name.
           * @returns {Table|null} The matching table or null if not found.
           * @example
           * const table = base.getTable('Projects');
           */
          getTable(idOrName) {}

          /**
           * Retrieves a collaborator by ID, name, or email.
           * @param {string} idOrNameOrEmail - Collaborator ID, name, or email.
           * @returns {Collaborator|null} The matching collaborator or null if not found.
           * @example
           * const user = base.getCollaborator('user@example.com');
           */
          getCollaborator(idOrNameOrEmail) {}

          /**
           * Creates a new table (not production-ready).
           * @param {string} name - Table name.
           * @param {Array<Object>} fields - Field definitions.
           * @returns {Promise<void>}
           * @throws {Error} If not production-ready or API fails.
           * @example
           * await base.createTableAsync('NewTable', [{ title: 'Name', type: 'SingleLineText' }]);
           */
          async createTableAsync(name, fields) {}
        }
        2. Table:
        /**
         * Represents a NocoDB table with fields and views.
         * @class
         */
        class Table {
          /**
           * @param {Object} data - Table data.
           * @param {string} data.id - Table ID.
           * @param {string} data.name - Table name.
           * @param {string} data.description - Table description.
           * @param {Array<Object>} data.fields - Field definitions.
           * @param {Array<Object>} data.views - View definitions.
           * @param {Base} base - Parent base.
           */
          constructor(data, base) {}

          /**
           * Retrieves a field by ID or name.
           * @param {string} idOrName - Field ID or name.
           * @returns {Field|undefined} The matching field or undefined if not found.
           * @example
           * const field = table.getField('Title');
           */
          getField(idOrName) {}

          /**
           * Retrieves a view by ID or name.
           * @param {string} idOrName - View ID or name.
           * @returns {View|undefined} The matching view or undefined if not found.
           * @example
           * const view = table.getView('Active Projects');
           */
          getView(idOrName) {}

          /**
           * Creates a new field (not production-ready).
           * @param {Object} field - Field definition.
           * @param {string} field.title - Field name.
           * @param {string} field.type - Field type.
           * @returns {Promise<Field>} The created field.
           * @throws {Error} If field exists or API fails.
           * @example
           * await table.createFieldAsync({ title: 'Priority', type: 'SingleSelect' });
           */
          async createFieldAsync(field) {}

          /**
           * Retrieves a single record by ID.
           * @param {string} recordId - Record ID.
           * @param {Object} [options] - Query options.
           * @param {Array<string|Field>} [options.fields] - Fields to retrieve.
           * @returns {Promise<NocoDBRecord|null>} The record or null if not found.
           * @example
           * const record = await table.selectRecordAsync('rec123', { fields: ['Title'] });
           */
          async selectRecordAsync(recordId, options = {}) {}

          /**
           * Retrieves multiple records with filtering and sorting.
           * @param {Object} [options] - Query options.
           * @param {Array<{field: string|Field, direction: 'asc'|'desc'}>} [options.sorts] - Sorting criteria.
           * @param {Array<string|Field>} [options.fields] - Fields to retrieve.
           * @param {Array<string>} [options.recordIds] - Specific record IDs.
           * @param {number} [options.pageSize=100] - Maximum records.
           * @param {number} [options.page=0] - Page number.
           * @returns {Promise<RecordQueryResult>} Query result with records.
           * @example
           * const result = await table.selectRecordsAsync({ fields: ['Title'], pageSize: 100 });
           */
          async selectRecordsAsync(options = {}) {}

          /**
           * Creates a new record.
           * @param {Object} data - Record data with field names or IDs as keys.
           * @returns {Promise<string>} The created record’s ID.
           * @example
           * const id = await table.createRecordAsync({ Title: 'New Project' });
           */
          async createRecordAsync(data) {}

          /**
           * Creates multiple records.
           * @param {Array<{fields: {string: unknown}}>} data - Array of record data objects.
           * @returns {Promise<Array<string>>} Array of created record IDs.
           * @example
           * const ids = await table.createRecordsAsync([{ fields: { Title: 'Project 1' }, { fields: { Title: 'Project 2' }]);
           */
          async createRecordsAsync(data) {}

          /**
           * Updates an existing record.
           * @param {string| AntarcticaRecord} recordId - Record ID or record object.
           * @param {Object} data - Updated field values.
           * @returns {Promise<void>}
           * @example
           * await table.updateRecordAsync('rec123', { Status: 'In Progress' });
           */
          async updateRecordAsync(recordId, data) {}

          /**
           * Updates multiple records.
           * @param {Array<{id: string|NocoDBRecord, fields: Object}>} records - Records to update.
           * @returns {Promise<void>}
           * @example
           * await table.updateRecordsAsync([{ id: 'rec123', fields: { Status: 'Completed' } }]);
           */
          async updateRecordsAsync(records) {}

          /**
           * Deletes a record.
           * @param {string|NocoDBRecord} recordIdOrRecord - Record ID or record object.
           * @returns {Promise<boolean>} True if deleted successfully.
           * @example
           * await table.deleteRecordAsync('rec123');
           */
          async deleteRecordAsync(recordIdOrRecord) {}

          /**
           * Deletes multiple records.
           * @param {Array<string>} recordIds - Record IDs to delete.
           * @returns {Promise<boolean>} True if deleted successfully.
           * @example
           * await table.deleteRecordsAsync(['rec123', 'rec456']);
           */
          async deleteRecordsAsync(recordIds) {}

          /**
           * Triggers an action for specified rows using a Button field.
           * This is useful for bulk processing button actions (such as AI generation) programmatically.
           * @param {Object} params - Action parameters.
           * @param {Array<string>} params.rowIds - Array of record IDs to process (max 25).
           * @param {string} params.columnId - ID of the Button field to trigger.
           * @returns {Promise<any>} Response from the action.
           * @example
           * // Trigger action for multiple records
           * const buttonField = table.getField('AI Summary Button');
           * const records = await table.selectRecordsAsync({ pageSize: 10 });
           * const result = await table.generateRowsAsync({
           *   rowIds: records.recordIds,
           *   columnId: buttonField.id
           * });
           */
          async generateRowsAsync(params) {}
        }
        3. View:
        /**
         * Represents a NocoDB view with predefined filters.
         * @class
         */
        class View {
          /**
           * @param {Object} data - View data.
           * @param {string} data.id - View ID.
           * @param {string} data.name - View name.
           * @param {string} data.description - View description.
           * @param {string} data.type - View type (e.g., 'grid').
           * @param {Table} table - Parent table.
           */
          constructor(data, table) {}

          /**
           * Retrieves a single record by ID through the view.
           * @param {string} recordId - Record ID.
           * @param {Object} [options] - Query options.
           * @param {Array<string|Field>} [options.fields] - Fields to retrieve.
           * @returns {Promise<NocoDBRecord|null>} The record or null if not found.
           * @example
           * const record = await view.selectRecordAsync('rec123', { fields: ['Title'] });
           */
          async selectRecordAsync(recordId, options = {}) {}

          /**
           * Retrieves records from the view with optional sorting.
           * @param {Object} [options] - Query options.
           * @param {Array<{field: string|Field, direction: 'asc'|'desc'}>} [options.sorts] - Sorting criteria.
           * @param {Array<string|Field>} [options.fields] - Fields to retrieve.
           * @param {Array<string>} [options.recordIds] - Specific record IDs.
           * @param {number} [options.pageSize=100] - Maximum records.
           * @param {number} [options.page=0] - Page number.
           * @returns {Promise<RecordQueryResult>} Query result with records.
           * @example
           * const result = await view.selectRecordsAsync({ sorts: [{ field: 'Title', direction: 'asc' }] });
           */
          async selectRecordsAsync(options = {}) {}
        }

        4. Field:
        /**
         * Represents a NocoDB field with properties and options.
         * @class
         */
        class Field {
          /**
           * @param {Object} data - Field data.
           * @param {string} data.id - Field ID.
           * @param {string} data.name - Field name.
           * @param {string} data.type - Field type (e.g., 'SingleLineText').
           * @param {string} data.description - Field description.
           * @param {Object|null} data.options - Field-specific options.
           * @param {boolean} data.primary_key - Whether the field is a primary key.
           * @param {boolean} data.primary_value - Whether the field is the primary value.
           * @param {boolean} data.is_system_field - Whether the field is system-managed.
           * @param {Table} table - Parent table.
           */
          constructor(data, table) {}

          /**
           * Updates field options (not production-ready).
           * @param {Object} options - New options.
           * @returns {Promise<void>}
           * @throws {Error} If update fails.
           * @example
           * await field.updateOptionsAsync({ choices: ['High', 'Low'] });
           */
          async updateOptionsAsync(options) {}

          /**
           * Updates field description.
           * @param {string} description - New description.
           * @returns {Promise<Field>} The updated field.
           * @example
           * await field.updateDescriptionAsync('Updated description');
           */
          async updateDescriptionAsync(description) {}

          /**
           * Updates field name.
           * @param {string} name - New name.
           * @returns {Promise<Field>} The updated field.
           * @example
           * await field.updateNameAsync('NewTitle');
           */
          async updateNameAsync(name) {}
        }

        5. NocoDBRecord:
        /**
         * Represents a NocoDB record with typed cell values.
         * @class
         */
        class NocoDBRecord {
          /**
           * @param {Object} data - Record data.
           * @param {Table} table - Parent table.
           */
          constructor(data, table) {}

          /**
           * Retrieves a cell value for a field, typed based on field type.
           * @param {string|Field} fieldOrFieldIdOrName - Field ID, name, or Field object.
           * @returns {any} The cell value (e.g., string, number, Collaborator, array).
           * @throws {Error} If field not found or not included in query.
           * @example
           * const title = record.getCellValue('Title');
           */
          getCellValue(fieldOrFieldIdOrName) {}

          /**
           * Retrieves a cell value as a formatted string.
           * @param {string|Field} fieldOrFieldIdOrName - Field ID, name, or Field object.
           * @param {Object} [options] - Formatting options.
           * @param {Field} [options.customField] - Override field for formatting.
           * @param {any} [options.customValue] - Override value for formatting.
           * @returns {string} The formatted string value.
           * @example
           * const status = record.getCellValueAsString('Status');
           */
          getCellValueAsString(fieldOrFieldIdOrName, options = {}) {}
        }

        6. RecordQueryResult:
        /**
         * Represents a query result with paginated records.
         * @class
         */
        class RecordQueryResult {
          /**
           * @param {Object} data - Query data.
           * @param {Table} table - Parent table.
           * @param {View|null} view - Parent view, if applicable.
           * @param {Object} options - Query options.
           */
          constructor(data, table, view, options) {}

          /**
           * Retrieves a record by ID.
           * @param {string} recordId - Record ID.
           * @returns {NocoDBRecord} The matching record.
           * @throws {Error} If record not found.
           * @example
           * const record = result.getRecord('rec123');
           */
          getRecord(recordId) {}

          /**
           * Loads more records if available.
           * @returns {Promise<RecordQueryResult|null>} Updated result or null if no more records.
           * @example
           * if (result.hasMoreRecords) await result.loadMoreRecords();
           */
          async loadMoreRecords() {}
        }

        7. Collaborator:
        /**
         * Represents a NocoDB collaborator (user).
         * @class
         */
        class Collaborator {
          /**
           * @param {Object} data - Collaborator data.
           * @param {string} data.id - User ID.
           * @param {string} data.email - User email.
           * @param {string|null} data.name - User display name.
           */
          constructor(data) {}
        }
        8. Input/Output:
        /**
         * Prompts the user to select a table.
         * @param {string} label - Prompt label.
         * @returns {Promise<Table|null>} The selected table or null if canceled.
         * @example
         * const table = await input.tableAsync('Select a table:');
         */
        async function input.tableAsync(label) {}

        /**
         * Prompts the user to select a field from a table.
         * @param {string} label - Prompt label.
         * @param {Table} table - The table to select fields from.
         * @returns {Promise<Field|null>} The selected field or null if canceled.
         * @example
         * const field = await input.fieldAsync('Select a field:', table);
         */
        async function input.fieldAsync(label, table) {}

        /**
         * Outputs a text message.
         * @param {string} message - The message to display.
         * @example
         * output.text('Operation completed.');
         */
        function output.text(message) {}

        /**
         * Outputs data as a table.
         * @param {Array<Object>} data - Array of objects to display.
         * @example
         * output.table([{ ID: 'rec123', Title: 'Project' }]);
         */
        function output.table(data) {}

        9. Remote API Calls:
        /**
         * Performs an HTTP request to an external API.
         * @param {string} url - The API endpoint URL.
         * @param {Object} [options] - Request options.
         * @param {string} [options.method='GET'] - HTTP method.
         * @param {Object} [options.headers] - Request headers.
         * @param {string|Object} [options.body] - Request body.
         * @returns {Promise<Object>} The response object with status, headers, and body.
         * @example
         * const response = await remoteFetchAsync('https://api.example.com/data', {
         *   method: 'POST',
         *   headers: { 'Content-Type': 'application/json' },
         *   body: JSON.stringify({ query: 'value' })
         * });
         */
        async function remoteFetchAsync(url, options) {}

        /**
         * Native fetch API for HTTP requests.
         * @param {string} url - The API endpoint URL.
         * @param {Object} [options] - Request options.
         * @returns {Promise<Response>} The fetch response.
         * @example
         * const response = await fetch('https://api.example.com/data');
         */
        async function fetch(url, options) {}
      </api_reference>
      <examples>
        <example>
          # Task: List all record IDs from a user-selected table with pagination.
          const table = await input.tableAsync('Select a table:');
          const records = await table.selectRecordsAsync({ pageSize: 100 });
          while(records.hasMoreRecords) {
            await records.loadMoreRecords();
          }
          output.table(recordIds.map(id => ({ ID: id })));
          output.text(\`Found \${recordIds.length} records.\`);
        </example>
        <example>
        # Task: Create a new record in a user-selected table.
        const table = await input.tableAsync('Select a table:');
        const record = await table.createRecordAsync({
          fields: {
            Title: 'New Record',
            Description: 'This is a new record.'
          }
        })
        output.text('Record created.');
        </example>
      </examples>
    </prompt>
    `,
    instruction:
      'Complete the code after the cursor position with appropriate function calls. Do not return the before or after cursor text.',
    fileContent: `${metadata?.textBeforeCursor}[CURSOR]${metadata?.textAfterCursor}`,
  };
};
