// import Vue from 'vue'
// import Vuex from 'vuex'
// import axios from 'axios'
// import users from './modules/users.state.js'
// import projects from './modules/projects.state.js'
// import admin from './modules/admin.state.js'


// import VueClipboard from 'vue-clipboard2'
// import BlockUI from 'vue-blockui'
// //import createMutationsSharer from "vuex-shared-mutations";
//
// var SocialSharing = require('vue-social-sharing');
//
// Vue.use(Vuex)
// Vue.use(VueClipboard)
//
// Vue.use(SocialSharing);
// Vue.use(BlockUI)

import createPersistedState from 'vuex-persistedstate';

// const plugins = []
// if (process.env.VUE_ENV === 'client') {
//   plugins.push(createPersistedState({
//     storage: window.localStorage
//   }))
// }

/**************** START : paddle.com ****************/
// let paddleClient = null;
//
// if (process.client && paddleClient === null) {
//   const Paddle = window.paddle;
//
//   console.log(window);
//
//   let err = window.Paddle.Setup({
//     vendor: 29248,
//     debug: true
//   });
//
//   console.log('paddle setup err',err);
// }
/**************** END : paddle.com ****************/


//
//
//
// const store = () => new Vuex.Store({
//
//   // store resource
//   state: {
//     paidUser: false
//   },
//
//   // modules: {
//   //   users,
//   //   admin,
//   //   projects
//   // },
//
//
//   //return modified resources
//   getters: {
//     // allTodos(state) {
//     //   return state.todos
//     // },
//     // activeTodos(state) {
//     //   return state.todos.filter(todo => !todo.completed)
//     // },
//     // completedTodos(state) {
//     //   return state.todos.filter(todo => todo.completed)
//     // },
//     GtrPaidUser(state) {
//       return state.paidUser;
//     }
//
//
//   },
//
//   //change resource here - start with Mut
//   mutations: {
//
//     MutSetPaidUser(state, inputData) {
//       state.paidUser = inputData;
//     },
//
//     // // list
//     // MutSetTodos(state, todos) {
//     //   state.todos = todos
//     // },
//     //
//     // // new
//     // MutAddTodos(state, todo) {
//     //   state.todos.push(todo)
//     // },
//     //
//     // // delete
//     // MutRemoveTodos(state, todo) {
//     //   var i = state.todos.indexOf(todo)
//     //   state.todos.splice(i, 1)
//     // },
//     //
//     // // filter
//     // MutFilterTodos(state, value) {
//     //   state.todos.forEach((todo) => {
//     //     todo.completed = !value
//     //   })
//     // },
//     //
//     // MutSetBlogs(state, _blogs) {
//     //   console.log('_blogs.length', _blogs.length);
//     //   state.blogs = _blogs;
//     // }
//
//   },
//
//   // start with Act
//   actions: {
//
//     ActPollSession({commit, getters}, todo) {
//       console.log('Within action : ActPollSession')
//       setInterval(async () => {
//         console.log('Poll section : ')
//         if (getters.GtrUser) {
//           try {
//             let res = await axios.get('/api/users/me');
//             if (res.data === null) {
//               console.log('Setting user to null : no session available')
//               commit('MutSetUser', null)
//             }
//           } catch (e) {
//             console.log('Setting user to null : http error')
//             commit('MutSetUser', null)
//           }
//         }
//       }, 300000);
//     },
//     // ActAddTodo({commit}, todo) {
//     //   commit('MutAddTodos', todo)
//     // },
//     //
//     // ActSetTodos({commit}, todos) {
//     //   commit('MutSetTodos', todos)
//     // },
//     //
//     // ActRemoveTodo({commit}, todo) {
//     //   commit('MutRemoveTodos', todo)
//     // },
//
//     // ActAllDone({state, commit}) {
//     //   var value = state.todos.filter(todo => todo.completed).length === state.todos.length
//     //   commit('MutFilterTodos', value)
//     // },
//
//     // ActSaveTodos({state}) {
//     //   //axios.put('/api/todos', { todos: state.todos })
//     //   console.log(state);
//     // },
//
//     async ActGetBlogs({state, commit}) {
//
//       console.log('ActGetBlogs');
//
//       let blogs = await axios.get('/api/v1/routeFunction')
//       console.log(blogs.data);
//       commit('MutSetBlogs', blogs.data);
//
//     },
//
//     async ActGetProfits({state, commit}, params) {
//
//       //console.log('ActGetProfits', params);
//
//       let profits = await axios.get('/api/v1/profit_made', {params: params})
//
//       //console.log(profits);
//
//       return profits.data;
//
//     },
//
//     async ActNewRefferalLink({state, commit}) {
//       //console.log('ActNewRefferalLink');
//       try {
//         let profits = await axios.post('/api/v1/referral')
//         //console.log(profits);
//         return profits.data;
//       } catch (e) {
//         console.log('error', e);
//         return e;
//       }
//     },
//
//     async ActGetUrl({state, commit}, urlParamObj) {
//
//       //console.log('url:', urlParamObj['url']);
//       //console.log('params:', urlParamObj['params']);
//       try {
//         let value = await axios.get(urlParamObj['url'], {params: urlParamObj['params']})
//         //console.log(value);
//         return value.data;
//       } catch (e) {
//         console.log('error in get url:', urlParamObj, e);
//         return e;
//       }
//     },
//
//     async ActPostUrl({state, commit}, urlParamObj) {
//       //console.log('url:', urlParamObj['url']);
//       //console.log('body:', urlParamObj['body']);
//       try {
//         let value = await axios.post(urlParamObj['url'], urlParamObj['body'])
//         //console.log(value);
//         return value.data;
//       } catch (e) {
//         console.log('error in post url:', e.response);
//         return e.response;
//       }
//     },
//
//     async ActGetTopProfits({state, commit}, params) {
//
//       //console.log('ActGetTopProfits', params);
//
//       let profits = await axios.get('/api/v1/profit_made/topprofits', {params: params})
//
//       return profits.data;
//
//     },
//
//     nuxtServerInit({commit, rootState}, {req}) {
//
//       // commit('MutSetTodos', req.session ? (req.session.todos || []) : [])
//       //
//       // console.log('nuxtserverinit + + + + + +',process.server,process.client);
//       //
//       // if(req.session && req.user) {
//       //   // console.log('req.session',req.session);
//       //    console.log('req.user',req.user);
//       //   // console.log('rootState',rootState);
//       //   commit('MutSetUser', req.user);
//       // }
//
//     }
//
//   },
//   //plugins: [createMutationsSharer({ predicate: (mutation, state) => true })]
//
//
// })
//
// export default store


export const state = () => ({
  paidUser: false
})


export const mutations = {

  MutSetPaidUser(state, inputData) {
    state.paidUser = inputData;
  },
}


export const actions = {

  ActPollSession({commit, getters}, todo) {
    console.log('Within action : ActPollSession')
    setInterval(async () => {
      console.log('Poll section : ')
      if (getters.GtrUser) {
        try {
          let res = await axios.get('/api/users/me');
          if (res.data === null) {
            console.log('Setting user to null : no session available')
            commit('MutSetUser', null)
          }
        } catch (e) {
          console.log('Setting user to null : http error')
          commit('MutSetUser', null)
        }
      }
    }, 5000);
  },

  async ActGetBlogs({state, commit}) {

    console.log('ActGetBlogs');

    let blogs = await axios.get('/api/v1/routeFunction')
    console.log(blogs.data);
    commit('MutSetBlogs', blogs.data);

  },

  async ActGetProfits({state, commit}, params) {

    //console.log('ActGetProfits', params);

    let profits = await axios.get('/api/v1/profit_made', {params: params})

    //console.log(profits);

    return profits.data;

  },

  async ActNewRefferalLink({state, commit}) {
    //console.log('ActNewRefferalLink');
    try {
      let profits = await axios.post('/api/v1/referral')
      //console.log(profits);
      return profits.data;
    } catch (e) {
      console.log('error', e);
      return e;
    }
  },

  async ActGetUrl({state, commit}, urlParamObj) {

    //console.log('url:', urlParamObj['url']);
    //console.log('params:', urlParamObj['params']);
    try {
      let value = await axios.get(urlParamObj['url'], {params: urlParamObj['params']})
      //console.log(value);
      return value.data;
    } catch (e) {
      console.log('error in get url:', urlParamObj, e);
      return e;
    }
  },

  async ActPostUrl({state, commit}, urlParamObj) {
    try {
      let value = await axios.post(urlParamObj['url'], urlParamObj['body'])
      //console.log(value);
      return value.data;
    } catch (e) {
      console.log('error in post url:', e.response);
      return e.response;
    }
  },

  async ActGetTopProfits({state, commit}, params) {
    let profits = await axios.get('/api/v1/profit_made/topprofits', {params: params})
    return profits.data;
  },

  nuxtServerInit({commit, rootState}, {req}) {

  }

}





export const strict = false;
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
