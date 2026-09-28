import type { NcTour } from '../tours'
import { collectTours } from '../tours'

const ceModules = import.meta.glob<{ default?: NcTour }>('../tours/defs/*.ts', { eager: true })

export const useTourRegistry = createSharedComposable(() => {
  const allTours = collectTours(ceModules)

  function getTourById(id: string): NcTour | undefined {
    return allTours.find((t) => t.id === id)
  }

  return { allTours, getTourById }
})
