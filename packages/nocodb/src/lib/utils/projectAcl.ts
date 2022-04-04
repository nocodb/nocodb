export default {
  owner: '*',
  creator: '*',
  guest: {},
  editor: {
    auditRowUpdate: true,
    passwordChange: true,
    // new permissions
    // project
    projectGet: true,
    projectList: true,
    //table
    tableList: true,
    tableGet: true,

    // data
    dataList: true,
    dataUpdate: true,
    dataDelete: true,
    dataInsert: true,
    dataRead: true,
    commentsCount: true,
    exportCsv: true,

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
    xcExportAsCsv: true
  },
  commenter: {
    formViewGet: true,
    passwordChange: true,
    // project
    projectGet: true,
    exportCsv: true,

    //table
    tableGet: true,
    // sort & filter
    sortList: true,
    viewList: true,
    columnList: true,

    mmList: true,
    commentList: true,
    commentRow: true,

    // data
    dataList: true,
    dataRead: true,
    commentsCount: true,

    xcTableAndViewList: true,
    xcVirtualTableList: true,
    projectList: true,
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
    xcExportAsCsv: true
  },
  viewer: {
    formViewGet: true,
    passwordChange: true,
    // project
    projectGet: true,
    //table
    tableGet: true,
    // data
    dataList: true,
    dataRead: true,
    commentsCount: true,
    exportCsv: true,

    // sort & filter
    sortList: true,

    mmList: true,
    hmList: true,
    commentList: true,
    commentRow: false,

    xcTableAndViewList: true,
    xcVirtualTableList: true,
    projectList: true,
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
    xcExportAsCsv: true
  },
  user_new: {
    passwordChange: true,
    projectList: true
  },
  user: {
    passwordChange: true,
    pluginList: true,
    pluginRead: true,
    pluginTest: true,
    isPluginActive: true,
    pluginUpdate: true,
    projectCreate: true,
    projectList: true,
    handleAxiosCall: true,
    testConnection: true,
    projectCreateByWeb: true,
    projectCreateByWebWithXCDB: true,
    xcPluginRead: true,
    xcMetaTablesImportZipToLocalFsAndDb: true,
    xcMetaTablesExportDbToZip: true,
    auditRowUpdate: true
  }
};

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
