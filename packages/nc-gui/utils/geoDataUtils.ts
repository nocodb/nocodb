const latLongToJoinedString = (lat: number, long: number) =>
  `${lat.toFixed(7).replace('.', ',')};${long.toFixed(7).replace('.', ',')}`

export { latLongToJoinedString }
