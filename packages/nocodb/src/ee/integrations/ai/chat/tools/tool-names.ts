export const ChatToolName = {
  // Schema
  LIST_TABLES: 'list_tables',
  DESCRIBE_TABLE: 'describe_table',
  CREATE_TABLE: 'create_table',
  DELETE_TABLE: 'delete_table',
  RENAME_TABLE: 'rename_table',
  ADD_FIELD: 'add_field',
  MODIFY_FIELD: 'modify_field',
  DELETE_FIELD: 'delete_field',
  CREATE_VIEW: 'create_view',
  DELETE_VIEW: 'delete_view',
  RENAME_VIEW: 'rename_view',
  LIST_VIEWS: 'list_views',

  // Data
  QUERY_RECORDS: 'query_records',
  CREATE_RECORDS: 'create_records',
  UPDATE_RECORDS: 'update_records',
  DELETE_RECORDS: 'delete_records',
  AGGREGATE: 'aggregate',
  LIST_LINKED_RECORDS: 'list_linked_records',
  LINK_RECORDS: 'link_records',
  UNLINK_RECORDS: 'unlink_records',

  // View
  LIST_VIEW_FIELDS: 'list_view_fields',
  UPDATE_VIEW_FIELDS: 'update_view_fields',
  SET_DISPLAY_FIELD: 'set_display_field',
  ADD_FILTER: 'add_filter',
  LIST_FILTERS: 'list_filters',
  REMOVE_FILTER: 'remove_filter',
  ADD_SORT: 'add_sort',
  LIST_SORTS: 'list_sorts',
  REMOVE_SORT: 'remove_sort',
  SET_GROUP_BY: 'set_group_by',
  CLEAR_GROUP_BY: 'clear_group_by',

  // UI
  OPEN_TABLE: 'open_table',
  OPEN_VIEW: 'open_view',
  OPEN_DASHBOARD: 'open_dashboard',

  // Dashboard
  LIST_DASHBOARDS: 'list_dashboards',
  GET_DASHBOARD: 'get_dashboard',
  CREATE_DASHBOARD: 'create_dashboard',
  UPDATE_DASHBOARD: 'update_dashboard',
  DELETE_DASHBOARD: 'delete_dashboard',
  LIST_WIDGETS: 'list_widgets',
  GET_WIDGET: 'get_widget',
  CREATE_WIDGET: 'create_widget',
  UPDATE_WIDGET: 'update_widget',
  DELETE_WIDGET: 'delete_widget',
  DUPLICATE_WIDGET: 'duplicate_widget',
  GET_WIDGET_DATA: 'get_widget_data',
  ADD_WIDGET_FILTER: 'add_widget_filter',
  LIST_WIDGET_FILTERS: 'list_widget_filters',
  REMOVE_WIDGET_FILTER: 'remove_widget_filter',

  // Data (extended)
  QUERY_RECORDS_BY_COMMENTS: 'query_records_by_comments',
  MANAGE_COMMENTS: 'manage_comments',

  // Docs
  LIST_DOCUMENTS: 'list_documents',
  GET_DOCUMENT: 'get_document',
  CREATE_DOCUMENT: 'create_document',
  UPDATE_DOCUMENT: 'update_document',
  DELETE_DOCUMENT: 'delete_document',
  PATCH_DOCUMENT: 'patch_document',
  LIST_DOCUMENT_COMMENTS: 'list_document_comments',
  ADD_DOCUMENT_COMMENT: 'add_document_comment',
  RESOLVE_DOCUMENT_COMMENT: 'resolve_document_comment',

  // Sandbox
  EXECUTE_CODE: 'execute_code',

  // Web (powered by exa-js)
  WEB_SEARCH: 'web_search',
  WEB_SCRAPE: 'web_scrape',

  // Interaction
  ASK_USER: 'ask_user',
  GENERATE_ARTIFACT_SCHEMA: 'generate_artifact_schema',
  ANNOUNCE: 'announce',
} as const;

export type ChatToolName = (typeof ChatToolName)[keyof typeof ChatToolName];
