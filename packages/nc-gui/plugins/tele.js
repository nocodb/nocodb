import io from 'socket.io-client'
import Vue from 'vue'

export default function({
  app,
  $axios,
  store,
  route
}, inject) {
  let socket

  const init = async(token) => {
    try {
      if (socket) {
        socket.disconnect()
      }
      const url = new URL($axios.defaults.baseURL, window.location.href.split(/[?#]/)[0]).href
      socket = io(url, {
        extraHeaders: { 'xc-auth': token }
      })

      socket.on('connect_error', () => {
        socket.disconnect()
        socket = null
      })
    } catch {
    }
  }

  app.router.onReady(() => {
    app.router.afterEach(function(to, from) {
      if (!socket || (to.path === from.path && (to.query && to.query.type) === (from.query && from.query.type))) {
        return
      }
      socket.emit('page', {
        path: to.matched[0].path + (to.query && to.query.type ? `?type=${to.query.type}` : '')
      })
    })
    if (socket) {
      socket.emit('page', {
        path: route.matched[0].path + (route.query && route.query.type ? `?type=${route.query.type}` : '')
      })
    }
  })

  const tele = {
    emit(evt, data) {
      // debugger
      if (socket) {
        socket.emit('event', {
          event: evt,
          ...(data || {}),
          path: gatPath(app)
        })
      }
    }
  }

  inject('tele', tele)
  inject('e', tele.emit)

  function getListener(binding) {
    return function(e) {
      if (!socket) {
        return
      }
      const event = binding.value && binding.value[0]
      const data = binding.value && binding.value[1]
      const extra = binding.value && binding.value.slice(2)
      tele.emit(event,
        {
          data,
          extra
        })
    }
  }

  Vue.directive('t', {
    bind(el, binding, vnode) {
      if (vnode.componentInstance) {
        if (vnode.componentInstance.$el) {
          vnode.componentInstance.$el.addEventListener('click', getListener(binding))
        } else {
          vnode.componentInstance.$on('click', getListener(binding))
        }
      } else {
        el.addEventListener('click', getListener(binding))
      }
    }
  })

  store.watch(state => state.project.appInfo && state.project.appInfo.teleEnabled && state.users.token, (token) => {
    if (token) {
      init(token).then(() => {
      })
    } else if (socket) {
      socket.disconnect()
      socket = null
    }
  })
  if (store.state.project.appInfo && store.state.project.appInfo.teleEnabled && store.state.users.token) {
    init(store.state.users.token).then(() => {
    })
  }
}

function gatPath(app) {
  return app && app.router && app.router.app && app.router.app.$route && app.router.app.$route.matched && app.router.app.$route.matched[0] && app.router.app.$route.matched[0].path
}
