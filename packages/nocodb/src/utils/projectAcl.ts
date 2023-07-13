import { OrgUserRoles, WorkspaceUserRoles } from 'nocodb-sdk';

const viewerPermissions = {
  include: {
    formViewGet: true,
    passwordChange: true,
    // project
    projectGet: true,
    //table
    tableGet: true,
    // data
    dataList: true,
    dataRead: true,
    dataExist: true,
    dataFindOne: true,
    dataGroupBy: true,
    commentsCount: true,
    exportCsv: true,
    exportExcel: true,

    // sort & filter
    sortList: true,
    filterList: true,
    projectInfoGet: true,
    projectUserMetaUpdate: true,

    galleryViewGet: true,
    kanbanViewGet: true,
    groupedDataList: true,

    mmList: true,
    hmList: true,
    commentList: true,
    commentRow: false,

    xcTableAndViewList: true,
    xcVirtualTableList: true,
    projectList: true,
    projectCost: true,
    PROJECT_READ_BY_WEB: true,

    tableXcModelGet: true,
    xcRelationList: true,
    tableList: true,
    viewList: true,
    functionList: true,
    sequenceList: true,
    procedureList: true,
    columnList: true,
    triggerList: true,
    relationList: true,
    relationListAll: true,
    indexList: true,
    list: true,
    xcExportAsCsv: true,
    dataCount: true,
    swaggerJson: true,

    commandPalette: true,

    // Docs
    pageGet: true,
    pageList: true,
    pageSearch: true,
    pageParents: true,
    pagePaginate: true,
    trackEvents: true,

    // dashboards
    layoutGet: true,
    layoutList: true,
    widgetsList: true,
    widgetGet: true,
    widgetFilterList: true,
  },
};
const rolePermissions = {
  owner: {
    exclude: {
      pluginList: true,
      pluginTest: true,
      pluginRead: true,
      pluginUpdate: true,
      isPluginActive: true,
      workspaceCreate: true,
      workspaceList: true,
      workspaceGet: true,
      workspaceUpdate: true,
      workspaceDelete: true,
      workspaceUserList: true,
      workspaceUserGet: true,
      workspaceUserUpdate: true,
      workspaceUserDelete: true,
      workspaceInvite: true,
      workspaceInvitationGet: true,
      workspaceInvitationUpdate: true,
      workspaceInvitationDelete: true,
      workspaceInvitationAccept: true,
      workspaceInvitationReject: true,
      workspaceInvitationTokenRead: true,
      createBase: true,
    },
  },
  creator: {
    exclude: {
      pluginList: true,
      pluginTest: true,
      pluginRead: true,
      pluginUpdate: true,
      isPluginActive: true,
      projectDelete: true,
      workspaceList: true,
      workspaceGet: true,
      workspaceUpdate: true,
      workspaceCreate: true,
      workspaceDelete: true,
      workspaceUserList: true,
      workspaceUserGet: true,
      workspaceUserUpdate: true,
      workspaceUserDelete: true,
      workspaceInvitationList: true,
      workspaceInvitationGet: true,
      workspaceInvitationUpdate: true,
      workspaceInvitationDelete: true,
      workspaceInvitationAccept: true,
      workspaceInvitationReject: true,
      workspaceInvitationTokenRead: true,
      createBase: true,
    },
  },
  guest: {},
  editor: {
    include: {
      hideAllColumns: true,
      showAllColumns: true,
      auditRowUpdate: true,
      passwordChange: true,
      // new permissions
      // project
      projectGet: true,
      projectList: true,
      projectCost: true,
      projectUserMetaUpdate: true,
      //table
      tableList: true,
      tableGet: true,

      // data
      dataList: true,
      dataUpdate: true,
      dataDelete: true,
      dataInsert: true,
      dataRead: true,
      dataExist: true,
      dataFindOne: true,
      dataGroupBy: true,
      commentsCount: true,
      exportCsv: true,
      exportExcel: true,

      viewList: true,
      columnList: true,
      viewColumnUpdate: true,

      sortList: true,
      sortCreate: true,
      sortUpdate: true,
      sortDelete: true,

      filterList: true,
      filterCreate: true,
      filterUpdate: true,
      filterDelete: true,
      filterGet: true,
      filterChildrenRead: true,

      mmList: true,
      hmList: true,
      mmExcludedList: true,
      hmExcludedList: true,
      btExcludedList: true,
      commentList: true,
      commentRow: true,

      formViewGet: true,
      projectInfoGet: true,
      gridColumnUpdate: true,
      galleryViewGet: true,
      kanbanViewGet: true,
      groupedDataList: true,

      // old
      xcTableAndViewList: true,
      xcAuditCreate: true,
      xcAttachmentUpload: true,
      xcVirtualTableList: true,
      rolesGet: true,
      tableXcModelGet: true,
      xcRelationsGet: true,
      xcModelsList: true,
      xcViewModelsList: true,
      xcProcedureModelsList: true,
      xcFunctionModelsList: true,
      xcTableModelsList: true,
      xcCronList: true,
      xcRelationList: true,
      tableMetaCreate: true,
      tableMetaDelete: true,
      tableMetaRecreate: true,
      viewMetaCreate: true,
      viewMetaDelete: true,
      viewMetaRecreate: true,
      procedureMetaCreate: true,
      procedureMetaDelete: true,
      procedureMetaRecreate: true,
      functionMetaCreate: true,
      functionMetaDelete: true,
      functionMetaRecreate: true,

      tableCreateStatement: true,
      tableInsertStatement: true,
      tableUpdateStatement: true,
      tableSelectStatement: true,
      tableDeleteStatement: true,

      functionList: true,
      sequenceList: true,
      procedureList: true,
      triggerList: true,
      relationList: true,
      relationListAll: true,
      indexList: true,
      list: true,
      viewRead: true,
      functionRead: true,
      procedureRead: true,

      getKnexDataTypes: true,
      DB_PROJECT_OPEN_BY_WEB: true,
      PROJECT_READ_BY_WEB: true,
      projectGenerateBackend: true,
      projectGenerateBackendGql: true,
      projectGetTsPolicyPath: true,
      projectGetPolicyPath: true,
      projectGetGqlPolicyPath: true,
      handleApiCall: true,
      executeRawQuery: true,
      projectHasDb: true,
      testConnection: true,
      projectChangeEnv: true,

      xcRoutesPolicyAllGet: true,
      grpcProtoDownloadZip: true,

      xcModelRowAuditAndCommentList: true,
      xcAuditCommentInsert: true,
      xcAuditModelCommentsCount: true,
      xcExportAsCsv: true,

      bulkDataInsert: true,
      bulkDataUpdate: true,
      bulkDataUpdateAll: true,
      bulkDataDelete: true,
      bulkDataDeleteAll: true,
      relationDataRemove: true,
      relationDataAdd: true,
      dataCount: true,
      upload: true,
      uploadViaURL: true,
      swaggerJson: true,

      commandPalette: true,

      // Docs
      pageGet: true,
      pageList: true,
      pageSearch: true,
      pageParents: true,
      pageCreate: true,
      pageUpdate: true,
      pageDelete: true,
      pageGpt: true,
      pagePaginate: true,
      pageDirectoryImport: true,
      docsMagicCreatePages: true,
      trackEvents: true,

      // dashboards
      layoutGet: true,
      layoutList: true,
      layoutCreate: true,
      widgetsList: true,
      widgetGet: true,
      widgetCreate: true,
      widgetUpdate: true,
      widgetDelete: true,
      widgetFilterList: true,
      widgetFilterCreate: true,
    },
  },
  commenter: {
    include: {
      formViewGet: true,
      passwordChange: true,
      // project
      projectGet: true,
      exportCsv: true,
      exportExcel: true,

      //table
      tableGet: true,
      // sort & filter
      sortList: true,
      viewList: true,
      columnList: true,

      mmList: true,
      hmList: true,
      commentList: true,
      commentRow: true,
      projectInfoGet: true,

      // data
      dataList: true,
      dataRead: true,
      dataExist: true,
      dataFindOne: true,
      dataGroupBy: true,
      commentsCount: true,

      galleryViewGet: true,
      kanbanViewGet: true,
      groupedDataList: true,

      xcTableAndViewList: true,
      xcVirtualTableList: true,
      projectList: true,
      projectCost: true,
      projectUserMetaUpdate: true,
      PROJECT_READ_BY_WEB: true,

      tableXcModelGet: true,
      xcRelationList: true,
      tableList: true,
      functionList: true,
      sequenceList: true,
      procedureList: true,
      triggerList: true,
      relationList: true,
      relationListAll: true,
      indexList: true,
      list: true,

      xcModelRowAuditAndCommentList: true,
      xcAuditCommentInsert: true,
      xcAuditModelCommentsCount: true,
      xcExportAsCsv: true,
      dataCount: true,
      swaggerJson: true,

      commandPalette: true,
      trackEvents: true,
    },
  },
  viewer: viewerPermissions,
  [OrgUserRoles.VIEWER]: {
    include: {
      workspaceProjectList: true,
      apiTokenList: true,
      apiTokenCreate: true,
      apiTokenDelete: true,
      passwordChange: true,
      projectList: true,
      workspaceList: true,
      workspaceGet: true,
      workspaceCreate: true,
      commandPalette: true,
      trackEvents: true,
      // allow only in cloud
      testConnection: true,
    },
  },
  [OrgUserRoles.SUPER_ADMIN]: '*',
  [OrgUserRoles.CREATOR]: {
    include: {
      workspaceProjectList: true,
      apiTokenList: true,
      apiTokenCreate: true,
      apiTokenDelete: true,
      upload: true,
      uploadViaURL: true,
      passwordChange: true,
      isPluginActive: true,
      // projectCreate: true,
      // projectCreateByWeb: true,
      // projectCreateByWebWithXCDB: true,
      projectList: true,
      projectCost: true,
      handleAxiosCall: true,
      testConnection: true,
      xcPluginRead: true,
      xcMetaTablesImportZipToLocalFsAndDb: true,
      xcMetaTablesExportDbToZip: true,
      auditRowUpdate: true,
      workspaceList: true,
      workspaceGet: true,
      workspaceCreate: true,
      workspaceUserList: true,
      genericGPT: true,
      commandPalette: true,
      runSelectQuery: true,

      // Docs
      pageGet: true,
      pageList: true,
      pageSearch: true,
      pageParents: true,
      pageCreate: true,
      pageUpdate: true,
      pageDelete: true,
      pageGpt: true,
      docsMagicCreatePages: true,
      pagePaginate: true,
      pageDirectoryImport: true,

      trackEvents: true,

      // dashboards
      layoutGet: true,
      layoutList: true,
      layoutCreate: true,
      widgetsList: true,
      widgetGet: true,
      widgetCreate: true,
      widgetUpdate: true,
      widgetDelete: true,
      widgetFilterList: true,
      widgetFilterCreate: true,
    },
  },

  // todo: role correction
  [WorkspaceUserRoles.CREATOR]: {
    // include: {
    //   workspaceList: true,
    //   workspaceGet: true,
    //   workspaceDelete: true,
    // },
    exclude: {
      pluginList: true,
      pluginTest: true,
      pluginRead: true,
      pluginUpdate: true,
      isPluginActive: true,
      projectDelete: true,
      createBase: true,
    },
  },
  [WorkspaceUserRoles.VIEWER]: {
    include: {
      ...viewerPermissions.include,
      workspaceList: true,
      projectUserMetaUpdate: true,
      workspaceGet: true,
      workspaceDelete: true,
      commandPalette: true,
    },
  },
  [WorkspaceUserRoles.COMMENTER]: {
    include: {
      workspaceList: true,
      projectUserMetaUpdate: true,
      workspaceGet: true,
      workspaceDelete: true,
      commandPalette: true,
    },
  },
  [WorkspaceUserRoles.EDITOR]: {
    include: {
      workspaceList: true,
      projectUserMetaUpdate: true,
      workspaceGet: true,
      workspaceDelete: true,
      commandPalette: true,
    },
  },
  [WorkspaceUserRoles.OWNER]: {
    exclude: {
      pluginList: true,
      pluginTest: true,
      pluginRead: true,
      pluginUpdate: true,
      isPluginActive: true,
      commandPalette: true,
    },
  },
};

// include viewer project role permissions
Object.assign(
  rolePermissions[WorkspaceUserRoles.VIEWER].include,
  rolePermissions['viewer'].include,
);
// include editor project role permissions
Object.assign(
  rolePermissions[WorkspaceUserRoles.EDITOR].include,
  rolePermissions['editor'].include,
);

// include editor project role permissions
Object.assign(
  rolePermissions[WorkspaceUserRoles.COMMENTER].include,
  rolePermissions['commenter'].include,
);

// todo: remove org level roles in cloud
// in cloud there is no org user roles, all user can create project and we can give all permissions
rolePermissions[OrgUserRoles.VIEWER] = rolePermissions[OrgUserRoles.CREATOR];

export default rolePermissions;
