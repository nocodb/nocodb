const relationNames = {
  mm: 'Many To Many',
  hm: 'Has Many',
  bt: 'Belongs To',
} as const

export function getRelationName(type: string) {
  return relationNames[type as keyof typeof relationNames]
}
