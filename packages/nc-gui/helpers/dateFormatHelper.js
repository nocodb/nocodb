export const dateFormat = [
    'DD-MM-YYYY', 'MM-DD-YYYY', 'YYYY-MM-DD',
    'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY/MM/DD',
    'DD MM YYYY', 'MM DD YYYY', 'YYYY MM DD'
]

export function validateDateFormat(v) {
    return dateFormat.includes(v)
}