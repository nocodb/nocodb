/* eslint-disable  */
import Vue from "vue";

import treeViewDataSerializer from "~/helpers/treeViewDataSerializer";
import deepFind from "~/helpers/deepFind";
import deepSet from "~/helpers/deepSet";
import {isMetaTable} from "@/helpers/xutils";

// const {path, config, jsonfile} = require('electron').remote.require('./libs')
const defaultProject = '';//jsonfile.readFileSync(config.electron.defaultProjectPath);
// import setProp from "../helpers/setProp";

export const state = () => ({
  list: [],

  /***
   * Row of project in xc.sqlite + projectJson
   */
  unserializedList: [],
  defaultProject,
  projectInfo: null,
  activeEnv: null,
  authDbAlias: null,
  projectId: null
});

export const mutations = {
  add(state, project) {
    state.list.push(project);
  },
  MutProjectId(state, projectId) {
    state.projectId = projectId;
  },
  update(state, data) {
  },
  remove(state, {project}) {
    state.list.splice(state.list.indexOf(project), 1);
  },
  list(state, projects) {
    Vue.set(state, "unserializedList", projects);
    // state.unserializedList = projects;
    // state.list = treeViewDataSerializer(projects);
    state.authDbAlias = projects[0]
      && projects[0].projectJson
      && projects[0].projectJson.auth
      && projects[0].projectJson.auth.jwt
      && projects[0].projectJson.auth.jwt.dbAlias
    Vue.set(state, "list", treeViewDataSerializer(projects));
    if (!(projects && projects[0] && projects[0].workingEnv)) {
      return
    }
    state.activeEnv = projects[0].workingEnv;

  },
  setProjectJson(state, projJson) {
    // setProp(state, ['unserializedList', 0, 'projectJson'], projJson)
    Vue.set(state.unserializedList, "0", {...state.unserializedList[0], projectJson: projJson});
    // state.unserializedList = JSON.parse(JSON.stringify(state.unserializedList))
  },
  setDefaultProjectJson(state, projJson) {
    // setProp(state, ['unserializedList', 0, 'projectJson'], projJson)
    Vue.set(state, "defaultProject", {...projJson});
  },
  MutProjectInfo(state, projectInfo) {
    state.projectInfo = projectInfo;
  }
};

function getSerializedEnvObj(data) {
  return data.reduce((obj, {key, value, enabled}) => {
    if (enabled) {
      obj[key] = value;
    }
    return obj;
  }, {});
}

export const getters = {

  GtrEnv(state) {
    return state.projectInfo && state.projectInfo.env;
  },
  GtrFirstDbAlias(state, getters) {
    return (state.unserializedList
        && state.unserializedList[0]
        && state.unserializedList[0].projectJson
        && state.unserializedList[0].projectJson.envs
        && getters.GtrEnv
        && state.unserializedList[0].projectJson.envs[getters.GtrEnv]
        && state.unserializedList[0].projectJson.envs[getters.GtrEnv].db
        && state.unserializedList[0].projectJson.envs[getters.GtrEnv].db[0]
        && state.unserializedList[0].projectJson.envs[getters.GtrEnv].db[0].meta
        && state.unserializedList[0].projectJson.envs[getters.GtrEnv].db[0].meta.dbAlias)
      || 'db';
  },


  GtrDbAliasList(state, getters) {
    return (state.unserializedList
        && state.unserializedList[0]
        && state.unserializedList[0].projectJson
        && state.unserializedList[0].projectJson.envs
        && getters.GtrEnv
        && state.unserializedList[0].projectJson.envs[getters.GtrEnv]
        && state.unserializedList[0].projectJson.envs[getters.GtrEnv].db)
      // && state.unserializedList[0].projectJson.envs[gettersGtrEnv].db.map(db => db.meta.dbAlias))
      || [];
  },


  list(state) {
    return state.list;
  },
  currentProjectFolder(state) {
    // unserializedList.o.folder
    return state.unserializedList && state.unserializedList[0] && state.unserializedList[0].folder;
  },
  projectQueriesFolder(state) {
    // unserializedList.o.folder
    console.log(state.unserializedList[0]);
    return state.unserializedList[0] && state.unserializedList[0].projectJson.queriesFolder;
  },
  projectApisFolder(state) {
    // unserializedList.o.folder
    console.log(state.unserializedList[0]);
    return state.unserializedList[0] && state.unserializedList[0].projectJson.apisFolder;
  },
  projectApisFolderPath(state) {
    return ''
    // unserializedList.o.folder
    // console.log(state.unserializedList[0]);
    // return path.join(state.unserializedList && state.unserializedList[0] && state.unserializedList[0].folder,
    //   'server', 'tool', state.unserializedList[0].projectJson.apisFolder);
  },
  GtrProjectJson(state) {
    return state.unserializedList && state.unserializedList[0] ? state.unserializedList[0].projectJson : null;
  },
  GtrProjectJsonUnserialized(state) {
    let data = JSON.parse(JSON.stringify(state.unserializedList && state.unserializedList[0] ? state.unserializedList[0].projectJson : null));
    if (!data) return {};
    for (let env of Object.values(data.envs)) {
      for (let db of env.db) {
        delete db.tables;
        delete db.functions;
        delete db.procedures;
        delete db.sequences;
        delete db.views;
      }
    }
    return data;
  },
  GtrProjectName(state) {
    return state.unserializedList && state.unserializedList[0] ? state.unserializedList[0].projectJson.title : "__project__";
  },
  GtrProjectPrefix(state) {
    return state.unserializedList && state.unserializedList[0] ? state.unserializedList[0].projectJson.prefix : null;
  },

  GtrApiEnvironment(state) {
    const projJson = state.unserializedList && state.unserializedList[0] ? state.unserializedList[0].projectJson : null;
    if (!projJson || !projJson.apiClient) return {};

    const serializedGlobEnv = getSerializedEnvObj(projJson.apiClient.data);

    return Object.entries(projJson.envs || {})
      .reduce((obj, [name, env]) => {
        const serializedEnvObj = getSerializedEnvObj(env.apiClient.data);
        obj[name] = {...serializedGlobEnv, ...serializedEnvObj};
        return obj;
      }, {});
  },
  GtrDefaultApiEnvironment(state) {
    if (!state.defaultProject || !state.defaultProject.apiClient) return {};
    const serializedGlobEnv = getSerializedEnvObj(state.defaultProject.apiClient.data);
    if (!state.defaultProject || !state.defaultProject.envs) return {};
    return Object.entries(state.defaultProject.envs)
      .reduce((obj, [name, env]) => {
        const serializedEnvObj = getSerializedEnvObj(env.apiClient.data);
        obj[name] = {...serializedGlobEnv, ...serializedEnvObj};
        return obj;
      }, {})
  },

  GtrApiClientEnvironment(state) {
    const projJson = state.unserializedList && state.unserializedList[0] ? state.unserializedList[0].projectJson : null;
    return projJson && projJson.envs ?
      Object.entries(projJson.envs)
        .reduce((obj, [name, env]) => ({[name]: {...projJson.api, ...env.api}, ...obj}), {}) : {}
  },


  GtrProjectIsGraphql(state) {
    return state.unserializedList[0] && state.unserializedList[0].projectJson.projectType === 'graphql';
  },

  GtrProjectIsMvc(state) {
    return state.unserializedList[0] && state.unserializedList[0].projectJson.type === 'mvc';
  },
  GtrProjectIsDocker(state) {
    return state.unserializedList[0] && state.unserializedList[0].projectJson.type === 'docker';
  },
  GtrProjectIsPackage(state) {
    return state.unserializedList[0] && state.unserializedList[0].projectJson.type === 'package';
  },
  GtrProjectIsTs(state) {
    return state.unserializedList[0] && state.unserializedList[0].projectJson.language === 'ts';
  },
  GtrProjectIsRest(state) {
    return state.unserializedList[0] && state.unserializedList[0].projectJson.projectType === 'rest';
  },
  GtrProjectIsGrpc(state) {
    return state.unserializedList[0] && state.unserializedList[0].projectJson.projectType === 'grpc';
  },
  GtrProjectType(state) {
    return state.unserializedList[0] && state.unserializedList[0].projectJson.projectType;
  },
  GtrProjectIsNoApis(state) {
    return (state.unserializedList[0] && state.unserializedList[0].projectJson.projectType === 'migrations')
      || (state.unserializedList[0] && state.unserializedList[0].projectJson.projectType === 'dbConnection');
  },
  GtrProjectIsMigration(state) {
    return state.unserializedList[0] && state.unserializedList[0].projectJson.projectType === 'migrations';
  },
  GtrProjectIsDbConnection(state) {
    return state.unserializedList[0] && state.unserializedList[0].projectJson.projectType === 'dbConnection';
  },

  GtrIsFirstLoad(state) {
    return !state.projectInfo || !state.projectInfo.projectHasDb || state.projectInfo.firstUser
  },

  GtrIsDocker(state) {
    return state.projectInfo && state.projectInfo.type === 'docker';
  },
  GtrIsMvc(state) {
    return state.projectInfo && state.projectInfo.type === 'mvc';
  },
  GtrEnvList(state) {
    return state.unserializedList[0]
    && state.unserializedList[0].projectJson
    && state.unserializedList[0].projectJson.envs ? Object.keys(state.unserializedList[0].projectJson.envs) : [];
  },

};

// let sqlMgr;
export const actions = {
  async clearProjects({commit, state, rootGetters, dispatch}) {
    await commit("list", []);
  },
  async loadProjects({commit, state, rootGetters, dispatch, ...rest}, id = null) {
    // dispatch("sqlMgr/instantiateSqlMgr", null, {root: true});
    // sqlMgr = rootGetters["sqlMgr/sqlMgr"];
    // const data = await sqlMgr.projectOpen({id}); // unsearialized data
    await new Promise(resolve => {
      const int = setInterval(() => {
        if (window.rehydrated) {
          clearTimeout(tm);
          resolve();
        }
      }, 100)
      const tm = setTimeout(() => {
        clearInterval(int);
        resolve();
      }, 5000)
    });
    try {
      let data,projectId;
      if (this.$router.currentRoute && this.$router.currentRoute.params && this.$router.currentRoute.params.project_id) {
        commit('MutProjectId', projectId = this.$router.currentRoute.params.project_id)
        await dispatch('users/ActGetProjectUserDetails', this.$router.currentRoute.params.project_id, {root: true});
        data = await this.dispatch('sqlMgr/ActSqlOp', [null, 'PROJECT_READ_BY_WEB']); // unsearialized data
      } else if (this.$router.currentRoute && this.$router.currentRoute.params && this.$router.currentRoute.params.shared_base_id) {
        const baseData = await this.dispatch('sqlMgr/ActSqlOp', [null, 'sharedBaseGet', {shared_base_id: this.$router.currentRoute.params.shared_base_id}]); // unsearialized data
        commit('MutProjectId', projectId = baseData.project_id)
        data = await this.dispatch('sqlMgr/ActSqlOp', [{project_id: baseData.project_id}, 'PROJECT_READ_BY_WEB']); // unsearialized data
        await dispatch('users/ActGetBaseUserDetails', this.$router.currentRoute.params.shared_base_id, {root: true});
      } else {
        commit('MutProjectId',  null)
        return
      }

      commit("list", data.data.list);
      commit("meta/MutClear", null, {root: true});
      if (this.$ncApis) {
        this.$ncApis.clear();
        this.$ncApis.setProjectId(projectId);
      }
    } catch (e) {
      this.$toast.error(e).goAway(3000);
      this.$router.push('/projects')
    }
  },
  async _loadTables({commit, state, dispatch, rootState}, data) {
    console.log("args", data);

    const {key, dbKey} = data;

    // console.time("table");
    console.log("project data from actions", data);
    const db = deepFind(state.unserializedList, dbKey);

    if (db) {
      console.log("DB found for tables load fn", db);
      // const client = await sqlMgr.projectGetSqlClient({
      //   env: data._nodes.env,
      //   dbAlias: data._nodes.dbAlias
      // });
      // const result = await client.tableList();
      const result = await dispatch('sqlMgr/ActSqlOpPlus', [
        {
          env: data._nodes.env,
          dbAlias: data._nodes.dbAlias
        },
        "tableList", {includeM2M: rootState.windows.includeM2M}
      ], {root: true});


      if (!result.data.list.length) {
        this.$toast.info('No tables in this schema').goAway(2000);
      }

      result.data.list = result.data.list.filter(t => rootState.windows.metatables || !isMetaTable(t.tn));
      console.log("tablelist", result.data.list);
      deepSet(state.unserializedList, result.data.list, `${key}`);
      commit("list", state.unserializedList);
    } else {
      console.error("DB Not found for tables load fn");
    }


    // console.timeEnd("table");
  },
  async loadTables({commit, state, dispatch}, data) {
    // type should tableDir and key should be for that table and dbkey
    const dbKey = data._nodes.dbKey || null;
    const {key} = data._nodes;

    await dispatch("_loadTables", {...data, dbKey, key});
  },
  async loadTablesFromParentTreeNode({commit, state, dispatch}, data) {
    let dbKey = data._nodes.dbKey || "";
    let {key, newTable} = data._nodes;

    dbKey = (newTable ? key : data._nodes.tableDirKey).replace('.tables', "");
    key = (newTable ? key : data._nodes.tableDirKey);
    data._nodes.type = "tableDir";

    await dispatch("_loadTables", {...data, dbKey, key});
  },
  async loadTablesFromChildTreeNode({commit, state, dispatch}, data) {
    const dbKey = data._nodes.dbKey;
    const key = data._nodes.key;

    data._nodes.type = "tableDir";

    await dispatch("_loadTables", {...data, dbKey, key});
  },
  async _loadViews({commit, state, dispatch}, data) {
    const {key, dbKey} = data;
    // console.log("project data from actions", state, data);
    const db = deepFind(state.unserializedList, dbKey);

    if (db) {
      console.log("DB found for tables load views", db);
      // const client = await sqlMgr.projectGetSqlClient({
      //   env: data._nodes.env,
      //   dbAlias: data._nodes.dbAlias
      // });
      // const result = await client.viewList();
      //


      const result = await this.dispatch('sqlMgr/ActSqlOp', [{
        env: data._nodes.env,
        dbAlias: data._nodes.dbAlias
      }, 'viewList'])


      // const result = await sqlMgr.sqlOp({
      //   env: data._nodes.env,
      //   dbAlias: data._nodes.dbAlias
      // }, 'viewList')


      if (!result.data.list.length) {
        console.log('no views');
        this.$toast.info('No views in this schema').goAway(2000);
      }
      deepSet(state.unserializedList, result.data.list, `${key}`);
      commit("list", state.unserializedList);
    } else {
      console.error("DB Not found for tables load fn");
    }
  },
  async loadViews({commit, state, dispatch}, data) {
    const dbKey = data._nodes.dbKey || null;
    const {key} = data._nodes;

    await dispatch("_loadViews", {...data, dbKey, key});
  },
  async loadViewsFromParentTreeNode({commit, state, dispatch}, data) {


    console.log("loadViewsFromParentTreeNode", data);
    let dbKey = data._nodes.dbKey || "";
    let {key, newView} = data._nodes;

    dbKey = (newView ? key : data._nodes.viewDirKey).replace(".views", "");
    key = (newView ? key : data._nodes.viewDirKey);
    data._nodes.type = "viewDir";

    await dispatch("_loadViews", {...data, dbKey, key});
  },
  async loadViewsFromChildTreeNode({commit, state, dispatch}, data) {
    const dbKey = data._nodes.dbKey || null;
    const {key} = data._nodes;

    data._nodes.type = "viewDir";

    await dispatch("_loadViews", {...data, dbKey, key});
  },
  async _loadFunctions({commit, state, dispatch}, data) {
    const {key, dbKey} = data;

    // console.log("project data from actions", state, data);
    const db = deepFind(state.unserializedList, dbKey);

    if (db) {
      console.log("DB found for tables load functions", db);
      // const client = await sqlMgr.projectGetSqlClient({
      //   env: data._nodes.env,
      //   dbAlias: data._nodes.dbAlias
      // });
      // const result = await client.functionList();

      // const result = await sqlMgr.sqlOp({
      //   env: data._nodes.env,
      //   dbAlias: data._nodes.dbAlias
      // }, 'functionList')
      const result = await this.dispatch('sqlMgr/ActSqlOp', [{
        env: data._nodes.env,
        dbAlias: data._nodes.dbAlias
      }, 'functionList'])


      if (!result.data.list.length) {
        this.$toast.info('No functions in this schema').goAway(2000);
      }

      deepSet(state.unserializedList, result.data.list, `${key}`);
      commit("list", state.unserializedList);
    } else {
      console.error("DB Not found for tables load fn");
    }
  },
  async loadFunctions({commit, state, dispatch}, data) {
    const {key, dbKey} = data._nodes;

    await dispatch("_loadFunctions", {...data, dbKey, key});
  },
  async loadFunctionsFromParentTreeNode({commit, state, dispatch}, data) {
    console.log("loadFunctionsFromParentTreeNode", data);
    let dbKey = data._nodes.dbKey || "";
    let {key, newFunction} = data._nodes;

    dbKey = (newFunction ? key : data._nodes.functionDirKey).replace(".functions", "");
    key = (newFunction ? key : data._nodes.functionDirKey);
    data._nodes.type = "functionDir";

    await dispatch("_loadFunctions", {...data, dbKey, key});
  },
  async loadFunctionsFromChildTreeNode({commit, state, dispatch}, data) {
    const dbKey = data._nodes.dbKey || null;
    const {key} = data._nodes;

    data._nodes.type = "functionDir";

    await dispatch("_loadFunctions", {...data, dbKey, key});
  },

  async _loadProcedures({commit, state, dispatch}, data) {
    const {key, dbKey} = data;

    // console.log("project data from actions", state, data);
    const db = deepFind(state.unserializedList, dbKey);

    if (db) {
      console.log("DB found for tables load procedures", db);
      // const client = await sqlMgr.projectGetSqlClient({
      //   env: data._nodes.env,
      //   dbAlias: data._nodes.dbAlias
      // });
      // const result = await client.procedureList();


      // const result = await sqlMgr.sqlOp({
      //   env: data._nodes.env,
      //   dbAlias: data._nodes.dbAlias
      // }, 'procedureList')


      const result = await this.dispatch('sqlMgr/ActSqlOp', [{
        env: data._nodes.env,
        dbAlias: data._nodes.dbAlias
      }, 'procedureList'])

      if (!result.data.list.length) {
        this.$toast.info('No procedures in this schema').goAway(2000);
      }

      console.log("_loadProcedures", result, {env: data._nodes.env, dbAlias: data._nodes.dbAlias});
      deepSet(state.unserializedList, result.data.list, `${key}`);
      commit("list", state.unserializedList);
    } else {
      console.error("DB Not found for tables load fn");
    }
  },
  async loadProcedures({commit, state, dispatch}, data) {
    const {key, dbKey} = data._nodes;

    await dispatch("_loadProcedures", {...data, dbKey, key});
  },


  async _loadSequences({commit, state, dispatch}, data) {
    const {key, dbKey} = data;
    console.log('_loadSequences', data)
    // console.log("project data from actions", state, data);
    const db = deepFind(state.unserializedList, dbKey);

    if (db) {
      console.log("DB found for tables load sequences", db);
      // const client = await sqlMgr.projectGetSqlClient({
      //   env: data._nodes.env,
      //   dbAlias: data._nodes.dbAlias
      // });
      // const result = await client.sequenceList();
      let result = {};
      if (0) {
        result.data = {};
        result.data.list = [];
      } else {
        // result = await client.sequenceList();
        const result = await this.sqlMgr.sqlOp({
          env: data._nodes.env,
          dbAlias: data._nodes.dbAlias
        }, 'sequenceList');
        if (!result.data.list.length) {
          this.$toast.info('No sequences in this schema').goAway(2000);
        }

      }
      console.log("_loadSequences", result, {env: data._nodes.env, dbAlias: data._nodes.dbAlias});
      deepSet(state.unserializedList, result.data.list, `${key}`);
      commit("list", state.unserializedList);
    } else {
      console.error("DB Not found for tables load fn");
    }
  },
  async loadSequences({commit, state, dispatch}, data) {
    const {key, dbKey} = data._nodes;
    console.log('loadSequences')
    await dispatch("_loadSequences", {...data, dbKey, key});
  },

  async loadProceduresFromParentTreeNode({commit, state, dispatch}, data) {
    console.log("loadProceduresFromParentTreeNode", data);
    let dbKey = data._nodes.dbKey || "";
    let {key, newProcedure} = data._nodes;

    dbKey = (newProcedure ? key : data._nodes.procedureDirKey).replace(".procedures", "");
    key = newProcedure ? key : data._nodes.procedureDirKey;
    data._nodes.type = "procedureDir";

    await dispatch("_loadProcedures", {...data, dbKey, key});
  },

  async loadSequencesFromParentTreeNode({commit, state, dispatch}, data) {
    console.log("loadSequencesFromParentTreeNode", data);
    let dbKey = data._nodes.dbKey || "";
    let {key, newSequence} = data._nodes;

    dbKey = (newSequence ? key : data._nodes.sequenceDirKey).replace(".sequences", "");
    key = newSequence ? key : data._nodes.sequenceDirKey;
    data._nodes.type = "sequenceDir";

    await dispatch("_loadSequences", {...data, dbKey, key});
  },


  async loadProceduresFromChildTreeNode({commit, state, dispatch}, data) {
    const dbKey = data._nodes.dbKey || null;
    const {key} = data._nodes;

    data._nodes.type = "procedureDir";

    await dispatch("_loadProcedures", {...data, dbKey, key});
  },


  async ActLoadProjectInfo({commit}) {
    const projectInfo = (await this.$axios({
      url: '/auth/type',
      baseURL: `${this.$axios.defaults.baseURL}/dashboard`,
      method: 'get'
    })).data;

    commit('MutProjectInfo', projectInfo)
  }
};

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
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
