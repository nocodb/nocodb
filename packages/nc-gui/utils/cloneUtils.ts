import rfdc from 'rfdc'

/**
 * Shared deep-clone utility. Single rfdc instance — handles Dates, Maps, Sets,
 * and cycles that JSON.parse(JSON.stringify(...)) drops.
 */
export const deepClone = rfdc()
