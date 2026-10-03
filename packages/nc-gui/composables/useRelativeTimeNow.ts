/** One ticking clock for every relative time on the page. */
export const useRelativeTimeNow = createSharedComposable(() => useNow({ interval: 30_000 }))
