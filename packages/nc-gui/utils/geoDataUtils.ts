const latLongToJoinedString = (lat: number, long: number) => `${lat.toFixed(2).replace('.', ',')};${long.toFixed(2).replace('.', ',')}`

export { latLongToJoinedString }
