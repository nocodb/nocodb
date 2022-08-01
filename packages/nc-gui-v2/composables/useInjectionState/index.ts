import type { InjectionKey } from 'vue'

export function useInjectionState<Arguments extends any[], Return>(
  composable: (...args: Arguments) => Return,
  keyName = 'InjectionState',
): readonly [useProvidingState: (...args: Arguments) => void, useInjectedState: () => Return | undefined] {
  const key: string | InjectionKey<Return> = Symbol(keyName)

  const useProvidingState = (...args: Arguments) => {
    const providedState = composable(...args)

    provide(key, providedState)

    return providedState
  }

  const useInjectedState = () => inject(key)

  return [useProvidingState, useInjectedState]
}
