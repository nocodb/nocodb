import type { InjectionKey } from 'vue'

export function useInjectionState<Arguments extends any[], Return>(
  composable: (...args: Arguments) => Return,
  keyName = 'InjectionState',
): readonly [useInjectionState: (...args: Arguments) => Return, useInjectedState: () => Return | undefined] {
  const key: string | InjectionKey<Return> = Symbol(keyName)

  let providableState: Return | undefined

  const useProvidingState = (...args: Arguments) => {
    const providedState = composable(...args)

    provide(key, providedState)

    providableState = providedState

    tryOnScopeDispose(() => {
      providableState = undefined
    })

    return providedState
  }

  const useInjectedState = () => {
    let injection = inject(key, undefined)

    if (typeof injection === 'undefined') {
      injection = providableState
    }

    return injection
  }

  tryOnScopeDispose(() => {
    providableState = undefined
  })

  return [useProvidingState, useInjectedState]
}
