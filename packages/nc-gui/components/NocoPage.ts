import { Suspense, Transition, computed, defineComponent, h, nextTick, onMounted, provide, reactive, useSlots } from 'vue'
import type { DefineComponent, KeepAliveProps, TransitionProps, VNode } from 'vue'
import { RouterView } from 'vue-router'
import type { RouteLocation, RouteLocationNormalized, RouteLocationNormalizedLoaded } from 'vue-router'
import type { RouterViewSlotProps } from '~/utils/pageUtils'
import { generateRouteKey, wrapInKeepAlive } from '~/utils/pageUtils'
import { useNuxtApp } from '#app'
import { _wrapIf } from '#app/components/utils'
// @ts-expect-error - this is a generated file
import { appKeepalive as defaultKeepaliveConfig, appPageTransition as defaultPageTransition } from '#build/nuxt.config.mjs'

const Component = defineComponent({
  // TODO: Type props

  props: ['routeProps', 'pageKey', 'hasTransition'],
  setup(props) {
    // Prevent reactivity when the page will be rerendered in a different suspense fork

    const previousKey = props.pageKey

    const previousRoute = props.routeProps.route

    // Provide a reactive route within the page
    const route = {} as RouteLocation
    for (const key in props.routeProps.route) {
      ;(route as any)[key] = computed(() => (previousKey === props.pageKey ? props.routeProps.route[key] : previousRoute[key]))
    }

    provide('_route', reactive(route))

    let vnode: VNode
    if (process.dev && process.client && props.hasTransition) {
      onMounted(() => {
        nextTick(() => {
          if (['#comment', '#text'].includes(vnode?.el?.nodeName)) {
            const filename = (vnode?.type as any).__file
            console.warn(
              `[nuxt] \`${filename}\` does not have a single root node and will cause errors when navigating between routes.`,
            )
          }
        })
      })
    }

    return () => {
      if (process.dev && process.client) {
        vnode = h(props.routeProps.Component)
        return vnode
      }

      return h(props.routeProps.Component)
    }
  },
})

// Custom page component
export default defineComponent({
  name: 'NocoPage',
  inheritAttrs: false,
  props: {
    name: {
      type: String,
    },
    transition: {
      type: [Boolean, Object] as any as () => boolean | TransitionProps,
      default: undefined,
    },
    keepalive: {
      type: [Boolean, Object] as any as () => boolean | KeepAliveProps,
      default: undefined,
    },
    route: {
      type: Object as () => RouteLocationNormalized,
    },
    pageKey: {
      type: [Function, String] as unknown as () => string | ((route: RouteLocationNormalizedLoaded) => string),
      default: null,
    },
  },
  setup(props, { attrs }) {
    const nuxtApp = useNuxtApp()
    const slots = useSlots()

    return () => {
      return h(
        RouterView,
        { name: props.name, route: props.route, ...attrs },
        {
          default: (routeProps: RouterViewSlotProps) => {
            if (!routeProps.Component) {
              return
            }

            const key = generateRouteKey(props.pageKey, routeProps)
            const transitionProps =
              props.transition ?? routeProps.route.meta.pageTransition ?? (defaultPageTransition as TransitionProps)

            return _wrapIf(
              Transition,
              transitionProps,
              wrapInKeepAlive(
                props.keepalive ?? routeProps.route.meta.keepalive ?? (defaultKeepaliveConfig as KeepAliveProps),
                h(
                  Suspense,
                  {
                    onPending: () => nuxtApp.callHook('page:start', routeProps.Component),
                    onResolve: () => nuxtApp.callHook('page:finish', routeProps.Component),
                  },
                  {
                    // Suspense slots
                    default: () => h(Component, { key, routeProps, pageKey: key, hasTransition: !!transitionProps } as {}),
                    fallback: () => (slots.default ? h(slots.default?.()[0]) : null),
                  },
                ),
              ),
            ).default()
          },
        },
      )
    }
  },
}) as DefineComponent<{
  name?: string
  route?: RouteLocationNormalized
  pageKey?: string | ((route: RouteLocationNormalizedLoaded) => string)
  [key: string]: any
}>
