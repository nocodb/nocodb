/**
 * Shorthand the tokenizer rewrites into plain words before anything else reads the query: chat-style
 * spellings ("tmrw", "w/o"), contractions ("what's", "isnt") and period codes ("q3", "ytd"). Keeping
 * this a pure rewrite means every reader (grammar, stage-2, legacy) sees the same canonical words.
 */

/** One token → plain words. */
export const SHORTHAND: Record<string, string[]> = {
  // dates
  'tmrw': ['tomorrow'],
  'tmrrw': ['tomorrow'],
  'tmr': ['tomorrow'],
  'tmw': ['tomorrow'],
  'tmro': ['tomorrow'],
  'tomo': ['tomorrow'],
  'tommorow': ['tomorrow'],
  'tomorow': ['tomorrow'],
  '2moro': ['tomorrow'],
  '2mrw': ['tomorrow'],
  'yday': ['yesterday'],
  'ystd': ['yesterday'],
  'yest': ['yesterday'],
  'tdy': ['today'],
  'eod': ['today'],
  'cob': ['today'],
  // "due eow": on or before the period's last day.
  'eow': ['<=', 'this', 'week'],
  'eom': ['<=', 'this', 'month'],
  'eoy': ['<=', 'this', 'year'],
  'eoq': ['<=', 'this', 'quarter'],
  'wtd': ['this', 'week'],
  'mtd': ['this', 'month'],
  'qtd': ['this', 'quarter'],
  'qtr': ['quarter'],
  'wk': ['week'],
  'yr': ['year'],
  'mth': ['month'],
  'b4': ['before'],
  'thru': ['through'],
  // joins and negation
  'w/': ['with'],
  'w/o': ['without'],
  'wo/': ['without'],
  'w/out': ['without'],
  'excl': ['excluding'],
  'incl': ['including'],
  '&': ['and'],
  // chat spellings
  'pls': ['please'],
  'plz': ['please'],
  'gimme': ['give', 'me'],
  'lemme': ['let', 'me'],
  'wanna': ['want', 'to'],
  'whos': ['who', 'is'],
  'a-z': ['a', 'to', 'z'],
  'z-a': ['z', 'to', 'a'],
  'u': ['you'],
  'r': ['are'],
  'ur': ['your'],
  'abv': ['above'],
  'blw': ['below'],
  'gt': ['>'],
  'gte': ['>='],
  'ge': ['>='],
  'lt': ['<'],
  'lte': ['<='],
  'le': ['<='],
  'eq': ['='],
  'ne': ['!='],
  'neq': ['!='],
  '≥': ['>='],
  '≤': ['<='],
  '≠': ['!='],
  '=>': ['>='],
  '=<': ['<='],
  'atleast': ['at', 'least'],
  'atmost': ['at', 'most'],
  'morethan': ['more', 'than'],
  'lessthan': ['less', 'than'],
  // workflow jargon
  'wip': ['in', 'progress'],
  'inprogress': ['in', 'progress'],
  'in-progress': ['in', 'progress'],
  'to-do': ['todo'],
  'todos': ['todo'],
  'oos': ['out', 'of', 'stock'],
}

/** Contractions, with or without the apostrophe. Possessives ("ann's") are not in here. */
export const CONTRACTIONS: Record<string, string[]> = {
  "what's": ['what', 'is'],
  'whats': ['what', 'is'],
  "who's": ['who', 'is'],
  "that's": ['that', 'is'],
  'thats': ['that', 'is'],
  "there's": ['there', 'is'],
  "here's": ['here', 'is'],
  "isn't": ['is', 'not'],
  'isnt': ['is', 'not'],
  "aren't": ['are', 'not'],
  'arent': ['are', 'not'],
  "wasn't": ['was', 'not'],
  'wasnt': ['was', 'not'],
  "weren't": ['were', 'not'],
  'werent': ['were', 'not'],
  "doesn't": ['does', 'not'],
  'doesnt': ['does', 'not'],
  "don't": ['do', 'not'],
  'dont': ['do', 'not'],
  "didn't": ['did', 'not'],
  'didnt': ['did', 'not'],
  "hasn't": ['has', 'not'],
  'hasnt': ['has', 'not'],
  "haven't": ['have', 'not'],
  'havent': ['have', 'not'],
  "ain't": ['is', 'not'],
  'aint': ['is', 'not'],
  "can't": ['cannot'],
  'cant': ['cannot'],
  "won't": ['will', 'not'],
  "i'm": ['i', 'am'],
  "let's": ['let', 'us'],
}

/**
 * Multi-word rewrites, longest first. "out of stock" is "stock at most 0" so the lexicon finds the
 * table's quantity field by its everyday name; "most expensive" is one superlative word.
 */
export const PHRASE_REWRITES: Array<[string[], string[]]> = [
  [
    ['out', 'of', 'stock'],
    ['stock', '<=', '0'],
  ],
  [
    ['sold', 'out'],
    ['stock', '<=', '0'],
  ],
  [
    ['no', 'stock'],
    ['stock', '<=', '0'],
  ],
  [
    ['zero', 'stock'],
    ['stock', '<=', '0'],
  ],
  [
    ['in', 'stock'],
    ['stock', '>', '0'],
  ],
  [
    ['work', 'in', 'progress'],
    ['in', 'progress'],
  ],
  [
    ['year', 'to', 'date'],
    ['from', 'jan', '1', 'to', 'today'],
  ],
  [
    ['by', 'end', 'of', 'week'],
    ['<=', 'this', 'week'],
  ],
  [
    ['by', 'end', 'of', 'month'],
    ['<=', 'this', 'month'],
  ],
  [
    ['by', 'end', 'of', 'year'],
    ['<=', 'this', 'year'],
  ],
  [
    ['end', 'of', 'week'],
    ['<=', 'this', 'week'],
  ],
  [
    ['end', 'of', 'month'],
    ['<=', 'this', 'month'],
  ],
  [
    ['end', 'of', 'quarter'],
    ['<=', 'this', 'quarter'],
  ],
  [
    ['end', 'of', 'year'],
    ['<=', 'this', 'year'],
  ],
  [['by', '<='], ['<=']],
  [['nobody', 'on', 'it'], ['unassigned']],
  [['no', 'one', 'assigned'], ['unassigned']],
  [['nobody', 'assigned'], ['unassigned']],
  [['not', 'assigned'], ['unassigned']],
  [
    ['who', 'is', 'on', 'it'],
    ['assigned', 'to'],
  ],
  [
    ['on', 'it'],
    ['assigned', 'to'],
  ],
  [['most', 'expensive'], ['priciest']],
  [['least', 'expensive'], ['cheapest']],
  [['most', 'costly'], ['priciest']],
  [['least', 'costly'], ['cheapest']],
  [['most', 'valuable'], ['biggest']],
  [['least', 'valuable'], ['smallest']],
  [['most', 'recent'], ['newest']],
  [['least', 'recent'], ['oldest']],
  [['most', 'recently'], ['newest']],
  [['not', 'equal', 'to'], ['!=']],
  [['other', 'than'], ['!=']],
  [['equal', 'to'], ['=']],
  [['same', 'as'], ['=']],
  [['up', 'to'], ['<=']],
  [['no', 'later', 'than'], ['<=']],
  [['no', 'earlier', 'than'], ['>=']],
  [['later', 'than'], ['after']],
  [['earlier', 'than'], ['before']],
  [['prior', 'to'], ['before']],
  [['newer', 'than'], ['after']],
  [['starting', 'from'], ['since']],
]

/**
 * "untagged", "unlabelled", "unscheduled": the participle names a field that is empty. Rewritten to
 * "without tagged" so the lexicon finds the field by its everyday name (tagged → Tags/Labels).
 */
export const UN_EMPTY_STEMS = new Set([
  'tagged',
  'labelled',
  'labeled',
  'categorized',
  'categorised',
  'scheduled',
  'dated',
  'priced',
  'estimated',
  'owned',
  'rated',
  'sourced',
  'described',
])

/** Quarter number → [first month index, last month index, last day]. */
export const QUARTERS: Record<string, [number, number, number]> = {
  q1: [0, 2, 31],
  q2: [3, 5, 30],
  q3: [6, 8, 30],
  q4: [9, 11, 31],
}
