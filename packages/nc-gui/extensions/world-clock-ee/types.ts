import type { AcceptableCity, AcceptableTimezone } from './timezone-data'

export interface SelectOption {
  value: string
  icon?: keyof typeof iconMap
  title?: string
}

export interface ClockInstance {
  id: number
  name: string
  city: AcceptableCity
  theme: number
}

export interface ClockDisplaySettings {
  showNumbers: boolean
  theme: number
  format: '12H' | '24H'
  timezone: AcceptableTimezone
  mode: 'Digital' | 'Analog' | 'Both'
}

export interface SavedData {
  config: {
    showNumbers: boolean
    format: '12H' | '24H'
    mode: 'Digital' | 'Analog' | 'Both'
  }
  instances: ClockInstance[]
}
