export default {
  projectsDir: { 'Create New Project': '' },
  project: {
    // "Environment Add": "PROJECT_ADD_ENV",
    // Refresh: "PROJECT_REFRESH",
    ...(process.env.NODE_ENV === 'dev' ? { 'Show _Nodes Info': 'SHOW_NODES' } : {})
  },
  env: {
    // "Database Add": "ENV_ADD_DB",
    // "Environment Refresh": "ENV_REFRESH",
    ...(process.env.NODE_ENV === 'dev' ? { 'Show _Nodes Info': 'SHOW_NODES' } : {})
  },
  db: {
    // "Create REST Apis": "CREATE_REST_APIS",
    // "Create GraphQL Apis": "CREATE_REST_APIS",
    // "Create Grpc Apis": "CREATE_REST_APIS",
    // "Migration Up": "ENV_DB_MIGRATION_UP"",
    ...(process.env.NODE_ENV === 'dev' ? { 'Show _Nodes Info': 'SHOW_NODES' } : {})
  },
  tableDir: {
    'Table Create': 'ENV_DB_TABLES_CREATE',
    'Tables Refresh': 'ENV_DB_TABLES_REFRESH',
    // 'Import Excel': 'IMPORT_EXCEL',
    // "Table Create": "ENV_DB_TABLES_CREATE",
    ...(process.env.NODE_ENV === 'dev' ? { 'Show _Nodes Info': 'SHOW_NODES' } : {})
  },
  viewDir: {
    // 'View Create': 'ENV_DB_VIEWS_CREATE',
    'Views Refresh': 'ENV_DB_VIEWS_REFRESH',
    ...(process.env.NODE_ENV === 'dev' ? { 'Show _Nodes Info': 'SHOW_NODES' } : {})
  },
  functionDir: {
    'Function Create': 'ENV_DB_FUNCTIONS_CREATE',
    'Functions Refresh': 'ENV_DB_FUNCTIONS_REFRESH',
    ...(process.env.NODE_ENV === 'dev' ? { 'Show _Nodes Info': 'SHOW_NODES' } : {})
  },
  migrationsDir: {
    ...(process.env.NODE_ENV === 'dev' ? { 'Show _Nodes Info': 'SHOW_NODES' } : {})
  },
  seedParserDir: {
    ...(process.env.NODE_ENV === 'dev' ? { 'Show _Nodes Info': 'SHOW_NODES' } : {})
  },
  apisDir: {
    ...(process.env.NODE_ENV === 'dev' ? { 'Show _Nodes Info': 'SHOW_NODES' } : {})
  },
  apiClientDir: {
    ...(process.env.NODE_ENV === 'dev' ? { 'Show _Nodes Info': 'SHOW_NODES' } : {})
  },
  sqlClientDir: {
    ...(process.env.NODE_ENV === 'dev' ? { 'Show _Nodes Info': 'SHOW_NODES' } : {})
  },
  procedureDir: {
    'Procedure Create': 'ENV_DB_PROCEDURES_CREATE',
    'Procedures Refresh': 'ENV_DB_PROCEDURES_REFRESH',
    ...(process.env.NODE_ENV === 'dev' ? { 'Show _Nodes Info': 'SHOW_NODES' } : {})
  },
  sequenceDir: {
    'Sequence Create': 'ENV_DB_SEQUENCES_CREATE',
    'Sequences Refresh': 'ENV_DB_SEQUENCES_REFRESH',
    ...(process.env.NODE_ENV === 'dev' ? { 'Show _Nodes Info': 'SHOW_NODES' } : {})
  },
  table: {
    'Table Rename': 'ENV_DB_TABLES_RENAME',
    // "Table Delete": "ENV_DB_TABLES_DELETE",
    // d1: null,
    // "Send to SQL Editor": {
    // 'Copy To Clipboard': {
    //   'Create Statement': 'ENV_DB_TABLES_CREATE_STATEMENT',
    //   'Insert Statement': 'ENV_DB_TABLES_INSERT_STATEMENT',
    //   'Update Statement': 'ENV_DB_TABLES_UPDATE_STATEMENT',
    //   'Select Statement': 'ENV_DB_TABLES_DELETE_STATEMENT',
    //   'Delete Statement': 'ENV_DB_TABLES_SELECT_STATEMENT'
    // },
    // d2: null,
    ...(process.env.NODE_ENV === 'dev' ? { 'Show _Nodes Info': 'SHOW_NODES' } : {})
  },
  view: {
    // 'View Rename': 'ENV_DB_VIEWS_RENAME',
    // 'View Delete': 'ENV_DB_VIEWS_DELETE',
    ...(process.env.NODE_ENV === 'dev' ? { 'Show _Nodes Info': 'SHOW_NODES' } : {})
  },
  function: {
    'Function Rename': 'ENV_DB_FUNCTIONS_RENAME',
    'Function Delete': 'ENV_DB_FUNCTIONS_DELETE',
    ...(process.env.NODE_ENV === 'dev' ? { 'Show _Nodes Info': 'SHOW_NODES' } : {})
  },
  procedure: {
    'Procedure Rename': 'ENV_DB_PROCEDURES_RENAME',
    'Procedure Delete': 'ENV_DB_PROCEDURES_DELETE',
    ...(process.env.NODE_ENV === 'dev' ? { 'Show _Nodes Info': 'SHOW_NODES' } : {})
  },
  sequence: {
    'Sequence Rename': 'ENV_DB_SEQUENCES_RENAME',
    'Sequence Delete': 'ENV_DB_SEQUENCESS_DELETE',
    ...(process.env.NODE_ENV === 'dev' ? { 'Show _Nodes Info': 'SHOW_NODES' } : {})
  }
}
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
