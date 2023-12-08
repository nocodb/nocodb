import { defineNuxtPlugin, getCurrentInstance } from '#imports'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('xc-ver-resize', {
    created: (el: Element) => {
      // create resizer element
      const resizer = document.createElement('div')
      resizer.className = 'resizer'
      resizer.style.position = 'absolute'
      resizer.style.height = '100%'
      resizer.style.width = '3px'
      resizer.style.top = '0'
      resizer.style.right = '-1px'
      resizer.style.zIndex = '999'

      // add resizer to element
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
      let startWidth: number

      // bind event handlers
      function initDrag(e: MouseEvent) {
        document.body.style.cursor = 'col-resize'
        startX = e.clientX
        startWidth = parseInt(document.defaultView?.getComputedStyle(el)?.width || '0', 10)
        document.documentElement.addEventListener('mousemove', doDrag, false)
        document.documentElement.addEventListener('mouseup', stopDrag, false)
        emit('xcstartresizing', startWidth)
      }

      ;(el as any).initDrag = initDrag

      let width: number | string

      // emit event on dragging
      function doDrag(e: MouseEvent) {
        width = `${startWidth + e.clientX - startX}px`
        emit('xcresizing', width)
      }

      // remove handlers and emit events on drag end
      function stopDrag() {
        resizer.classList.remove('primary')
        document.body.style.cursor = ''
        document.documentElement.removeEventListener('mousemove', doDrag, false)
        document.documentElement.removeEventListener('mouseup', stopDrag, false)
        emit('xcresize', width)
        emit('xcresized')
      }
    },
    beforeUnmount: (el: Element) => {
      const resizer = el.querySelector('.resizer')

      if (resizer) {
        resizer.removeEventListener('mousedown', (el as any).initDrag, false)
      }
    },
  })
})
