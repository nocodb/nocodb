import type { EffectScope, InjectionKey } from 'vue'
import { getCurrentScope } from 'vue'

type ExtendedScope<T> = { [key: symbol]: T } & EffectScope

export function useInjectionState<Arguments extends any[], Return>(
  composable: (...args: Arguments) => Return,
  keyName = 'InjectionState',
): readonly [useInjectionState: (...args: Arguments) => Return, useInjectedState: () => Return | undefined] {
  const keySymbol = Symbol(keyName)
  const key: string | InjectionKey<Return> = keySymbol

  const useProvidingState = (...args: Arguments) => {
    const providedState = composable(...args)

    const currentScope = getCurrentScope() as ExtendedScope<Return>
    currentScope[keySymbol] = providedState

    provide(key, providedState)

    return providedState
  }

  const useInjectedState = () => {
    let injection = inject(key, undefined)

    if (typeof injection === 'undefined') {
      const currentScope = getCurrentScope() as ExtendedScope<Return>
      injection = currentScope[keySymbol]
    }

    return injection
  }

  return [useProvidingState, useInjectedState]
}
