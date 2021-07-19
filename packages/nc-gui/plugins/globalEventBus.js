import Vue from 'vue'

const GlobalPlugins = {
  install(v) {
    v.prototype.$eventBus = new Vue()
  }
}

Vue.use(GlobalPlugins)
