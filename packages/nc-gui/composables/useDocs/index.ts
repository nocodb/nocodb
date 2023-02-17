export const PAGES_PER_PAGE_LIST = 10

export function useDocs() {
  watchers()

  const _states = states()

  const _actions = actions()

  return {
    ..._states,
    ..._actions,
  }
}
