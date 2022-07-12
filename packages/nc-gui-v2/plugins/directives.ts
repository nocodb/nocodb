import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('xc-ver-resize', {
    created: (el, bindings, vnode) => {
      // el.style.position = !el.style.position || el.style.position === 'static' ? 'relative' : el.style.position;
      const resizer = document.createElement('div')
      resizer.className = 'resizer'
      resizer.style.position = 'absolute'
      resizer.style.height = '100%'
      resizer.style.width = '3px'
      resizer.style.top = '0'
      resizer.style.right = '-1px'
      resizer.style.zIndex = '999'

      el.appendChild(resizer)
      resizer.addEventListener('mousedown', initDrag, false)

      const instance = getCurrentInstance()
      const emit =
        instance?.emit ??
        ((arg, data) => {
          const event = new CustomEvent(arg, { detail: data })
          ;(<HTMLElement>el).dispatchEvent(event)
        })

      let startX: number
      // let startY: number
      let startWidth: number

      function initDrag(e: MouseEvent) {
        document.body.style.cursor = 'col-resize'
        // resizer.classList.add('primary')
        startX = e.clientX
        // startY = e.clientY
        startWidth = parseInt(document.defaultView?.getComputedStyle(el)?.width || '0', 10)
        // startHeight = parseInt(document.defaultView.getComputedStyle(p).height, 10);
        document.documentElement.addEventListener('mousemove', doDrag, false)
        document.documentElement.addEventListener('mouseup', stopDrag, false)
      }

      let width: number | string
      // const emit = (vnode: any, name: string, data?: any) => {
      //   const handlers = (vnode.data && vnode.data.on) || (vnode.componentOptions && vnode.componentOptions.listeners)
      //
      //   if (handlers && handlers[name]) {
      //     handlers[name].fns(data)
      //   }
      // }

      function doDrag(e: MouseEvent) {
        width = `${startWidth + e.clientX - startX}px`
        // el.style.width = width
        emit('xcresizing', width)
      }

      function stopDrag() {
        resizer.classList.remove('primary')
        document.body.style.cursor = ''
        document.documentElement.removeEventListener('mousemove', doDrag, false)
        document.documentElement.removeEventListener('mouseup', stopDrag, false)
        emit('xcresize', width)
        emit('xcresized')
      }
    },
  })
})
