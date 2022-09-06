export const state = () => ({

  /**
   *
   * type : SELECT, INSERT, UPDATE, CREATE, DELETE, DROP
   *
   * query :
   *
   *
   * response :
   *      status : 0 / -1
   *
   */
  list: [{
    type: 'SELECT',
    query: 'SELECT 1',
    response: { status: 0 }
  }],
  clipboardQuery: null,
  // editors: ['', '', '']
  editors: [
    {
      type: 'temp',
      code: '',
      fileName: null,
      filePath: null,
      edited: false
    }, {
      type: 'temp',
      code: '',
      fileName: null,
      filePath: null,
      edited: false
    }, {
      type: 'temp',
      code: '',
      fileName: null,
      filePath: null,
      edited: false
    }
  ],

  sqlFilePaths: [],

  projectSqlFilePaths: {},
  currentProjectKey: ''

})

export const mutations = {

  MutSqlFilePathsAdd(state, args) {
    state.projectSqlFilePaths = {
      ...state.projectSqlFilePaths,
      [state.currentProjectKey]: [...state.projectSqlFilePaths[state.currentProjectKey], args]
    }
  },

  MutSqlFilePathsRemove(state, index) {
    state.projectSqlFilePaths[state.currentProjectKey].splice(index, 1)
    state.projectSqlFilePaths[state.currentProjectKey] = [...state.projectSqlFilePaths[state.currentProjectKey]]
  },

  MutList(state, list) {
    state.projectSqlFilePaths[state.currentProjectKey] = list
  },
  MutCurrentProjectKey(state, currentProjectKey) {
    state.currentProjectKey = currentProjectKey
  },
  MutListAdd(state, args) {
    state.list.unshift(args)
    if (state.list.length > 500) { state.list.pop() }
  },

  MutListRemove(state, index) {
    // find index and set status
    state.list.splice(index, 1)
    state.list = [...state.list]
  },
  MutListRemoveItem(state, item) {
    state.list = state.list.filter(query => item.query !== query.query)
  },
  MutSetClipboardQuery(state, clipboardQuery) {
    state.clipboardQuery = clipboardQuery
  },
  MutSetEditorByIndex(state, { editor, index }) {
    state.editors[index] = editor
    state.editors = [...state.editors]
  },
  MutSetEditors(state, editors) {
    state.editors = editors.map(editor => ({ ...editor }))
  }

}

export const getters = {
  GtrCurrentSqlFilePaths(state) {
    return state.projectSqlFilePaths[state.currentProjectKey]
  }
}

export const actions = {

  async executeQuery({ commit, state, rootState }, { envs, query }) {
    // const sqlMgr = rootState.sqlMgr.sqlMgr
    let result
    // const type = SqlQueryParser.getType(query);
    // const typeColor = SqlQueryParser.getColorForQueryType(type)

    // let t = process.hrtime();
    // eslint-disable-next-line no-useless-catch
    try {
      // const client = await sqlMgr.projectGetSqlClient(envs);

      // result = await sqlMgr.sqlOp(envs, 'executeRawQuery', query);
      result = await this.dispatch('sqlMgr/ActSqlOp', [envs, 'executeRawQuery', query])

      // var t1 = process.hrtime(t);
      // var t2 = (t1[0] + t1[1] / 1000000000).toFixed(2);

      // commit('MutListAdd', {
      //   id: Date.now(),
      //   name: '',
      //   query: query,
      //   type,
      //   typeColor,
      //   response: {status: 0},
      //   createdAt: Date.now(),
      //   timeTaken: t2,
      // })
    } catch (e) {
      // var t1 = process.hrtime(t);
      // var t2 = (t1[0] + t1[1] / 1000000000).toFixed(2);
      //
      // commit('MutListAdd', {
      //   id: Date.now(),
      //   name: '',
      //   query: query,
      //   type,
      //   typeColor,
      //   response: {status: -1},
      //   createdAt: Date.now(),
      //   timeTaken: t2,
      //
      // });
      throw e
    }
    return result

    //
    //
    // let a = {...action};
    // try {
    //   commit('notification/MutToggleProgressBar', true, {root: true});
    //
    //   if(action.body) {
    //     try {
    //       a.body = JSON.parse(a.body);
    //     } catch (e) {
    //       console.log(e);
    //     }
    //   }
    //   if(action.headers) {
    //     try {
    //       a.headers = JSON.parse(a.headers);
    //     } catch (e) {
    //       console.log(e);
    //     }
    //   }
    //
    //   a.response = {};
    //   let data = await axios({
    //     url: a.url,
    //     method: a.type,
    //     data: a.body,
    //     headers: a.headers
    //   });
    //
    //     a.response.status = data.status;
    //     a.response.data = data.data;
    //   console.log(data);
    // } catch (e) {
    //   console.log(Object.keys(e), Object.entries(e));
    //   a.response = e.response;
    //   //throw e;
    // } finally {
    //   commit('notification/MutToggleProgressBar', false, {root: true});
    //   commit('MutListAdd', {...a,body:JSON.stringify(a.body),headers:JSON.stringify(a.headers)});
    //   return a.response;
    // }
  },
  async loadSqlCollectionForProject({ commit, state }, { projectName, projectId }) {
    const key = projectName + '__' + projectId
    commit('MutCurrentProjectKey', key)
    if (!(key in state.projectSqlFilePaths)) {
      commit('MutList', [])
    }
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
