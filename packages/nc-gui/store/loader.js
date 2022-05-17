const state = () => ({
  message: null,
  progress: null
})

const mutations = {
  MutMessage(state, message) {
    state.message = message
  },
  MutProgress(state, progress) {
    state.progress = progress
  },
  MutClear(state) {
    state.progress = null
    state.message = null
  }
}

export {
  state,
  mutations
}
