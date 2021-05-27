// const {SqlMgr} = require("electron").remote.require("./libs");
import headers from "../components/apiClient/headers";

// let sqlMgrSingleton = null;


// import axios from 'axios';
//
// if (!this.$axios) {
//   this.$axios = axios.create({
//     baseURL: 'http://localhost:8080',
//   });
// }
//
// const this.$axios = this.$axios;


function translateUiToLibCall(args, op, opArgs) {

  let data = {
    type: null,
    module: null,
    title: null
  }

  switch (op) {

    case 'projectCreate1':
      data.type = "Create";
      data.title = opArgs.project.title;
      data.module = "Project";
      break;
    case 'projectReadByFolder':
      data.type = "Reading";
      data.title = '';
      data.module = "Project";
      break;
    case 'tableCreate':
      data.type = "Create";
      data.title = opArgs._tn || opArgs.tn;
      data.module = "table";
      break;
    case 'tableList':
      data.api = 'DB_TABLE_LIST'
      data.type = "List";
      data.title = 'list';
      data.module = "table";
      break;
    case 'tableUpdate':
      data.type = "Update";
      data.title = opArgs._tn || opArgs.tn;
      data.module = "table";
      break;
    case 'tableDelete':
      data.type = "Delete";
      data.title = opArgs._tn || opArgs.tn;
      data.module = "table";
      break;

    case 'viewCreate':
      data.type = "Create";
      data.title = opArgs._tn || opArgs.view_name;
      data.module = "View";
      break;
    case 'viewList':
      data.type = "List";
      data.title = opArgs._tn || opArgs.view_name;
      data.module = "View";
      break;
    case 'viewUpdate':
      data.type = "Update";
      //data.title = opArgs.view_name;
      data.module = "View";
      break;
    case 'viewDelete':
      data.type = "Delete";
      data.title = opArgs._tn || opArgs.view_name;
      data.module = "View";
      break;

    case 'functionCreate':
      data.type = "Create";
      data.title = opArgs.function_name;
      data.module = "Function";
      break;
    case 'functionList':
      data.type = "";
      //data.title = opArgs.function_name;
      data.module = "Function";
      break;
    case 'functionUpdate':
      data.type = "Update";
      data.title = opArgs.function_name;
      data.module = "Function";
      break;
    case 'functionDelete':
      data.type = "Delete";
      data.title = opArgs.function_name;
      data.module = "Function";
      break;

    case 'procedureCreate':
      data.type = "Create";
      data.title = opArgs.procedure_name;
      data.module = "Procedure";
      break;
    case 'procedureList':
      data.type = "List";
      //data.title = opArgs.procedure_name;
      data.module = "Procedure";
      break;
    case 'procedureUpdate':
      data.type = "Update";
      data.title = opArgs.procedure_name;
      data.module = "Procedure";
      break;
    case 'procedureDelete':
      data.type = "Delete";
      data.title = opArgs.procedure_name;
      data.module = "Procedure";
      break;

    case 'sequenceCreate':
      data.type = "Create";
      data.title = opArgs.sequence_name;
      data.module = "Sequence";
      break;
    case 'sequenceList':
      data.type = "List";
      //data.title = opArgs.sequence_name;
      data.module = "Sequence";
      break;
    case 'sequenceUpdate':
      data.type = "Update";
      data.title = opArgs.sequence_name;
      data.module = "Sequence";
      break;
    case 'sequenceDelete':
      data.type = "Delete";
      data.title = opArgs.sequence_name;
      data.module = "Sequence";
      break;

    case 'triggerCreate':
      data.type = "Create ";
      data.title = opArgs._tn || opArgs.tn;
      data.module = "trigger";
      break;
    case 'triggerList':
      data.type = "Create ";
      //data.title = opArgs.trigger_name;
      data.module = "trigger";
      break;
    case 'triggerUpdate':
      data.type = "Update ";
      data.title = opArgs.trigger_name;
      data.module = "trigger";
      break;
    case 'triggerDelete':
      data.type = "Delete ";
      data.title = opArgs.trigger_name;
      data.module = "trigger";
      break;

    case 'indexCreate':
      data.type = "Create Index on ";
      data.title = opArgs._tn || opArgs.tn;
      data.module = "table";
      break;
    case 'indexList':
      data.type = "List";
      //data.title = opArgs.tn;
      data.module = "table";
      break;
    case 'indexUpdate':
      data.type = "Update Index on ";
      data.title = opArgs._tn || opArgs.tn;
      data.module = "table";
      break;
    case 'indexDelete':
      data.type = "Delete Index on ";
      data.title = opArgs._tn || opArgs.tn;
      data.module = "table";
      break;

    case 'rowCreate':
      data.type = "";
      data.title = opArgs;
      data.module = "";
      break;
    case 'rowList':
      data.type = "List";
      data.title = opArgs;
      data.module = "";
      break;
    case 'rowUpdate':
      data.type = "";
      data.title = opArgs;
      data.module = "";
      break;
    case 'rowDelete':
      data.type = "";
      data.title = opArgs;
      data.module = "";
      break;

    case 'seedInit':
      data.type = "Init";
      data.title = '';
      data.module = "Seed";
      break;
    case 'seedTerm':
      data.type = "Term";
      data.title = '';
      data.module = "Seed";
      break;
    case 'seedStart':
      data.type = "Start";
      data.title = '';
      data.module = "Seed";
      break;
    case 'seedStop':
      data.type = "Stop";
      data.title = '';
      data.module = "Seed";
      break;
    case 'seedSettingsRead':
      data.type = "Settings";
      data.title = '';
      data.module = "Seed";
      break;
    case 'seedSettingsCreate':
      data.type = "Settings Create";
      data.title = '';
      data.module = "Seed";
      break;

    case 'projectGenerateBackend':
      data.type = "Generate Code";
      data.title = '';
      data.module = "Project";
      break;

    case 'projectGenerateBackendGql':
      data.type = "Generate GraphQL Code";
      data.title = '';
      data.module = "Project";
      break;
    case 'tableRename':
      data.type = "Table rename";
      data.title = '';
      data.module = "";
      break;

    case 'relationCreate':
    case 'xcVirtualRelationCreate':
      data.type = "Relation create";
      data.title = '';
      data.module = "";
      break;


    case 'relationDelete':
    case 'xcVirtualRelationDelete':
      data.type = "Relation delete";
      data.title = '';
      data.module = "";
      break;

    default:
      throw new Error(`Should not have occurred ${op}`);
  }

  return data;

}

export const state = () => ({
  sqlMgr: null
});

export const mutations = {
  set(state, sqlMgrSingleton) {
    state.sqlMgr = sqlMgrSingleton;
  },

};

export const getters = {
  // sqlMgr(state) {
  //   return state.sqlMgr;
  // }
};

export const actions = {

  //
  // async instantiateSqlMgr({commit, state, ...rest}, data) {
  //   console.log(this)
  //   if (!state.sqlMgr) {
  //     sqlMgrSingleton = new SqlMgr(rest);
  //     console.log(
  //       "\n\n************************sqlMgr is created************************\n\n."
  //     );
  //     commit("set", sqlMgrSingleton);
  //   } else {
  //     console.log("sqlMgr is already instantiated.");
  //     console.log(state.sqlMgr);
  //   }
  //   return state.sqlMgr;
  // },


  async ActSqlOpPlus({commit, state, dispatch, rootState}, [args, op, opArgs]) {
    const params = {};
    if (this.$router.currentRoute && this.$router.currentRoute.params && this.$router.currentRoute.params.project_id) {
      params.project_id = this.$router.currentRoute.params.project_id;
    }
    let data = translateUiToLibCall(args, op, opArgs);

    commit('notification/MutListAdd', {status: 'pending', ...data}, {root: true});

    const headers = {};
    if (rootState.project.projectInfo && rootState.project.projectInfo.authType === 'masterKey') {
      headers['xc-master-key'] = rootState.users.masterKey || '';
    } else if (rootState.project.projectInfo && rootState.project.projectInfo.authType === 'jwt') {
      headers['xc-auth'] = rootState.users.token || '';
    }


    try {
      let result = null;
      if (data.module === 'Project') {
        result = await dispatch('ActSqlOp', [args, op, opArgs]);
      } else if (data.module === 'Seed' || (data.title || '').toLowerCase() === 'list' || data.type.toLowerCase() === 'list') {
        result = await dispatch('ActSqlOp', [args, op, opArgs]);
      } else {
        console.log(data);
        // result = await state.sqlMgr.sqlOpPlus(args, op, opArgs);
        result = (await this.$axios({
            url: '?q=sqlOpPlus_' + op,
            baseURL: process.env.NODE_ENV === 'production' ? './' : 'http://localhost:8080/dashboard',
            // baseURL: 'http://localhost:8080/dashboard',
            data: {api: op, ...args, ...params, args: opArgs, sqlOpPlus: true},
            headers,
            method: 'post'
          }
        )).data;

      }

      commit('notification/MutListRemove', {status: 'success', ...data}, {root: true});
      return result;
    } catch (e) {
      commit('notification/MutListRemove', {status: 'error', ...data}, {root: true});
      throw e;
    }

  },


  async ActSqlOp({commit, state, rootState}, [args, op, opArgs, cusHeaders, cusAxiosOptions, queryParams]) {
    const params = {};
    if (this.$router.currentRoute && this.$router.currentRoute.params && this.$router.currentRoute.params.project_id) {
      params.project_id = this.$router.currentRoute.params.project_id;
    }
    try {
      const headers = {};
      if (rootState.project.projectInfo && rootState.project.projectInfo.authType === 'masterKey') {
        headers['xc-master-key'] = rootState.users.masterKey;
      } else if (rootState.project.projectInfo && rootState.project.projectInfo.authType === 'jwt') {
        headers['xc-auth'] = rootState.users.token;
      }

      if (cusHeaders) {
        Object.assign(headers, cusHeaders)
      }
      return (await this.$axios({
        url: '?q=sqlOp_' + op,
        baseURL: process.env.NODE_ENV === 'production' ? './' : 'http://localhost:8080/dashboard',
        // baseURL: 'http://localhost:8080/dashboard',
        data: {api: op, ...args, ...params, args: opArgs},
        headers,
        method: 'post',
        params: (args && args.query) || {},
        ...(cusAxiosOptions || {}),

      })).data;
    } catch (e) {
      const err = new Error(e.response.data.msg);
      err.response = e.response;
      throw err;
    }

  },


  async ActUpload({commit, state, rootState}, [args, op, opArgs, file, cusHeaders, cusAxiosOptions]) {
    try {
      const params = {};
      if (this.$router.currentRoute && this.$router.currentRoute.params && this.$router.currentRoute.params.project_id) {
        params.project_id = this.$router.currentRoute.params.project_id;
      }
      const headers = {
        'Content-Type': 'multipart/form-data'
      };

      if (rootState.project.projectInfo && rootState.project.projectInfo.authType === 'masterKey') {
        headers['xc-master-key'] = rootState.users.masterKey;
      } else if (rootState.project.projectInfo && rootState.project.projectInfo.authType === 'jwt') {
        headers['xc-auth'] = rootState.users.token;
      }

      if (cusHeaders) {
        Object.assign(headers, cusHeaders)
      }

      const formData = new FormData();

      formData.append("file", file);
      formData.append('json', JSON.stringify({api: op, ...params, ...args, args: opArgs}));
      // formData.append('project_id', params.project_id);

      return (await this.$axios({
        url: '?q=sqlOp_' + op,
        baseURL: process.env.NODE_ENV === 'production' ? './' : 'http://localhost:8080/dashboard',
        // baseURL:  'http://localhost:8080/dashboard',
        data: formData, //{api: op, ...args, args: opArgs},
        headers,
        method: 'post',
        params: {project_id: params.project_id, ...((args && args.query) || {})},
        ...(cusAxiosOptions || {})
      })).data;
    } catch (e) {
      throw new Error(e.response.data.msg);
    }

  },


};

//
// class SqlMgr {
//
//   constructor(store) {
//     this.$axios = axios.create({
//       baseURL: 'http://localhost:8080',
//     });
//     this.store = store;
//   }
//
//
//   get token() {
//     // return this.store.rootGetters['users/GtrToken']
//   }
//
//   async projectOpen() {
//     // setInterval(async () => console.log('token', await this.store.dispatch('ActGetToken')), 1000);
//     // await new Promise(resolve => setTimeout(resolve, 500))
//     // console.log(await this.store.dispatch('ActGetToken'))
//     // return (await this.$axios.post('/xc?q=projectOpen', {api: 'PROJECT_READ_BY_WEB'}, {
//     //   headers: {
//     //     'xc-auth': await this.store.dispatch('ActGetToken')
//     //   }
//     // })).data;
//   }
//
//   async sqlOp(args, api, opArgs) {
//     // try {
//     //   return (await this.$axios.post('/xc?q=sqlOp_' + api, {api, ...args, args: opArgs}, {
//     //     headers: {
//     //       'xc-auth': await this.store.dispatch('ActGetToken')
//     //     }
//     //   })).data;
//     // } catch (e) {
//     //   throw new Error(e.response.data.msg);
//     // }
//   }
//
//   async sqlOpPlus(args, api, opArgs) {
//     // try {
//     //   return (await this.$axios.post('/xc?q=sqlOpPlus_' + api, {api, ...args, args: opArgs, sqlOpPlus: true}, {
//     //     headers: {
//     //       'xc-auth': await this.store.dispatch('ActGetToken')
//     //     }
//     //   })).data;
//     // } catch (e) {
//     //   throw new Error(e.response.data.msg);
//     // }
//   }
//
//   async projectGenerateBackend(opArgs) {
//     // return (await this.$axios.post('/xc?q=projectGenerateBackend', {api: 'projectGenerateBackend', args: opArgs}, {
//     //   headers: {
//     //     'xc-auth': await this.store.dispatch('ActGetToken')
//     //   }
//     // })).data;
//   }
//
//   async projectGenerateBackendGql(opArgs) {
//     // return (await this.$axios.post('/xc?q=projectGenerateBackendGql', {
//     //   api: 'projectGenerateBackendGql',
//     //   args: opArgs
//     // }, {
//     //   headers: {
//     //     'xc-auth': await this.store.dispatch('ActGetToken')
//     //   }
//     // })).data;
//   }
//
//   async projectGetTsPolicyPath(opArgs) {
//     // return (await this.$axios.post('/xc?q=projectGetTsPolicyPath', {api: 'projectGetTsPolicyPath', args: opArgs}, {
//     //   headers: {
//     //     'xc-auth': await this.store.dispatch('ActGetToken')
//     //   }
//     // })).data;
//   }
//
//
//   async projectGetGqlPolicyPath(opArgs) {
//     // return (await this.$axios.post('/xc?q=projectGetGqlPolicyPath', {
//     //   api: 'projectGetGqlPolicyPath',
//     //   args: opArgs
//     // }, {
//     //   headers: {
//     //     'xc-auth': await this.store.dispatch('ActGetToken')
//     //   }
//     // })).data;
//   }
//
//
//   async projectGetPolicyPath(opArgs) {
//     // return (await this.$axios.post('/xc?q=projectGetPolicyPath', {api: 'projectGetPolicyPath', args: opArgs}, {
//     //   headers: {
//     //     'xc-auth': await this.store.dispatch('ActGetToken')
//     //   }
//     // })).data;
//   }
//
//
//   async xcRoutesPolicyGet(opArgs) {
//     // return (await this.$axios.post('/xc?q=xcRoutesPolicyGet', {
//     //   api: 'xcRoutesPolicyGet',
//     //   args: opArgs
//     // }, {
//     //   headers: {
//     //     'xc-auth': await this.store.dispatch('ActGetToken')
//     //   }
//     // })).data;
//   }
//
//   async projectGetGrpcPolicyFromDb(opArgs) {
//     // return (await this.$axios.post('/xc?q=projectGetGrpcPolicyFromDb', {
//     //   api: 'projectGetGrpcPolicyFromDb',
//     //   args: opArgs
//     // }, {
//     //   headers: {
//     //     'xc-auth': await this.store.dispatch('ActGetToken')
//     //   }
//     // })).data;
//   }
//
//   async xcRpcPolicyUpdate(opArgs) {
//     // return (await this.$axios.post('/xc?q=xcRpcPolicyUpdate', {
//     //   api: 'xcRpcPolicyUpdate',
//     //   args: opArgs
//     // }, {
//     //   headers: {
//     //     'xc-auth': await this.store.dispatch('ActGetToken')
//     //   }
//     // })).data;
//   }
//
//   async xcRoutesPolicyUpdate(opArgs) {
//     // return (await this.$axios.post('/xc?q=xcRoutesPolicyUpdate', {
//     //   api: 'xcRoutesPolicyUpdate',
//     //   args: opArgs
//     // }, {
//     //   headers: {
//     //     'xc-auth': await this.store.dispatch('ActGetToken')
//     //   }
//     // })).data;
//   }
//
//   async xcResolverPolicyGet(opArgs) {
//     // return (await this.$axios.post('/xc?q=xcResolverPolicyGet', {
//     //   api: 'xcResolverPolicyGet',
//     //   args: opArgs
//     // }, {
//     //   headers: {
//     //     'xc-auth': await this.store.dispatch('ActGetToken')
//     //   }
//     // })).data;
//   }
//
//   async xcResolverPolicyUpdate(opArgs) {
//     // return (await this.$axios.post('/xc?q=xcResolverPolicyUpdate', {
//     //   api: 'xcResolverPolicyUpdate',
//     //   args: opArgs
//     // }, {
//     //   headers: {
//     //     'xc-auth': await this.store.dispatch('ActGetToken')
//     //   }
//     // })).data;
//   }
//
//   async importFresh(opArgs) {
//     // return (await this.$axios.post('/xc?q=importFresh', {api: 'importFresh', args: opArgs}, {
//     //   headers: {
//     //     'xc-auth': await this.store.dispatch('ActGetToken')
//     //   }
//     // })).data;
//   }
//
//   async writeFile(opArgs) {
//     // return (await this.$axios.post('/xc?q=writeFile', {api: 'writeFile', args: opArgs}, {
//     //   headers: {
//     //     'xc-auth': await this.store.dispatch('ActGetToken')
//     //   }
//     // })).data;
//   }
//
//
// }
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
