// Forked from https://github.com/inkling/htmldiff.js/blob/master/js/htmldiff.js

// The MIT License (MIT)

// Copyright (c) 2012 The Network Inc. and contributors
// Copyright (c) 2022 idesis GmbH, Max-Keith-Straße 66 (E 11), D-45136 Essen, https://www.idesis.de

// Permission is hereby granted, free of charge, to any person obtaining a copy of
// this software and associated documentation files (the "Software"), to deal in
// the Software without restriction, including without limitation the rights to
// use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
// of the Software, and to permit persons to whom the Software is furnished to do
// so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

/**
 * htmldiff.js is a library that compares HTML content. It creates a diff between two
 * HTML documents by combining the two documents and wrapping the differences with
 * <ins> and <del> tags. Here is a high-level overview of how the diff works.
 *
 * 1. Tokenize the before and after HTML with htmlToTokens.
 * 2. Generate a list of operations that convert the before list of tokens to the after
 *    list of tokens with calculateOperations, which does the following:
 *      a. Find all the matching blocks of tokens between the before and after lists of
 *         tokens with findMatchingBlocks. This is done by finding the single longest
 *         matching block with findMatch, then iteratively finding the next longest
 *         matching blocks that precede and follow the longest matching block.
 *      b. Determine insertions, deletions, and replacements from the matching blocks.
 *         This is done in calculateOperations.
 * 3. Render the list of operations by wrapping tokens with <ins> and <del> tags where
 *    appropriate with renderOperations.
 *
 * Example usage:
 *
 *   var htmldiff = require('htmldiff.js');
 *
 *   htmldiff('<p>this is some text</p>', '<p>this is some more text</p>')
 *   == '<p>this is some <ins>more </ins>text</p>'
 *
 *   htmldiff('<p>this is some text</p>', '<p>this is some more text</p>', 'diff-class')
 *   == '<p>this is some <ins class="diff-class">more </ins>text</p>'
 */

'use strict';

interface Token {
  string: string;
  key: string;
}

interface Segment {
  beforeTokens: Array<Token>;
  afterTokens: Array<Token>;
  beforeIndex: number;
  afterIndex: number;

  beforeMap: object;
  afterMap: object;
}

interface MatchT {
  segment: Segment;
  length: number;

  startInBefore: number;
  endInBefore: number;
  startInAfter: number;
  endInAfter: number;

  segmentStartInBefore: number;
  segmentStartInAfter: number;
  segmentEndInBefore: number;
  segmentEndInAfter: number;
}

type OperationType = 'insert' | 'delete' | 'replace' | 'equal' | 'none';

interface Operation {
  action: OperationType;
  startInBefore: number;
  endInBefore: number | null;
  startInAfter: number | null;
  endInAfter: number | null;
}

function isEndOfTag(char: string) {
  return char === '>';
}

function isStartOfTag(char: string) {
  return char === '<';
}

function isWhitespace(char: string) {
  return /^\s+$/.test(char);
}

/**
 * Determines if the given token is a tag.
 *
 * @param {string} token The token in question.
 *
 * @return {boolean|string} False if the token is not a tag, or the tag name otherwise.
 */
function isTag(token: string): boolean | string {
  const match = token.match(/^\s*<([^!>][^>]*)>\s*$/);
  return !!match && match[1].trim().split(' ')[0];
}

function isntTag(token: string) {
  return !isTag(token);
}

function isStartofHTMLComment(word: string) {
  return /^<!--/.test(word);
}

function isEndOfHTMLComment(word: string) {
  return /-->$/.test(word);
}

/**
 * Checks if the current word is the beginning of an atomic tag. An atomic tag is one whose
 * child nodes should not be compared - the entire tag should be treated as one token. This
 * is useful for tags where it does not make sense to insert <ins> and <del> tags.
 *
 * @param {string} word The characters of the current token read so far.
 *
 * @return {string|null} The name of the atomic tag if the word will be an atomic tag,
 *    null otherwise
 */
function isStartOfAtomicTag(word: string): string | null {
  // Note: "math" was removed from this list on Outline fork to support math-display, math-inline nodes
  const result = /^<(iframe|object|svg|script)/.exec(word);
  return result && result[1];
}

/**
 * Checks if the current word is the end of an atomic tag (i.e. it has all the characters,
 * except for the end bracket of the closing tag, such as '<iframe></iframe').
 *
 * @param {string} word The characters of the current token read so far.
 * @param {string} tag The ending tag to look for.
 *
 * @return {boolean} True if the word is now a complete token (including the end tag),
 *    false otherwise.
 */
function isEndOfAtomicTag(word: string, tag: string): boolean {
  return word.substring(word.length - tag.length - 2) === `</${tag}`;
}

/**
 * Checks if a tag is a void tag.
 *
 * @param {string} token The token to check.
 *
 * @return {boolean} True if the token is a void tag, false otherwise.
 */
function isVoidTag(token: string): boolean {
  return /^\s*<[^>]+\/>\s*$/.test(token);
}

/**
 * Checks if a token can be wrapped inside a tag.
 *
 * @param {string} token The token to check.
 *
 * @return {boolean} True if the token can be wrapped inside a tag, false otherwise.
 */
function isWrappable(token: string): boolean {
  return isntTag(token) || !!isStartOfAtomicTag(token) || isVoidTag(token);
}

/**
 * Creates a token that holds a string and key representation. The key is used for diffing
 * comparisons and the string is used to recompose the document after the diff is complete.
 *
 * @param {string} currentWord The section of the document to create a token for.
 *
 * @return {Token} A token object with a string and key property.
 */
function createToken(currentWord: string): Token {
  return {
    string: currentWord,
    key: getKeyForToken(currentWord),
  };
}

/**
 * A Match stores the information of a matching block. A matching block is a list of
 * consecutive tokens that appear in both the before and after lists of tokens.
 *
 * @param {number} startInBefore The index of the first token in the list of before tokens.
 * @param {number} startInAfter The index of the first token in the list of after tokens.
 * @param {number} length The number of consecutive matching tokens in this block.
 * @param {Segment} segment The segment where the match was found.
 */
function Match(
  startInBefore: number,
  startInAfter: number,
  length: number,
  segment: Segment,
) {
  this.segment = segment;
  this.length = length;

  this.startInBefore = startInBefore + segment.beforeIndex;
  this.startInAfter = startInAfter + segment.afterIndex;
  this.endInBefore = this.startInBefore + this.length - 1;
  this.endInAfter = this.startInAfter + this.length - 1;

  this.segmentStartInBefore = startInBefore;
  this.segmentStartInAfter = startInAfter;
  this.segmentEndInBefore = this.segmentStartInBefore + this.length - 1;
  this.segmentEndInAfter = this.segmentStartInAfter + this.length - 1;
}

/**
 * Tokenizes a string of HTML.
 *
 * @param {string} html The string to tokenize.
 *
 * @return {Array} The list of tokens.
 */
function htmlToTokens(html: string): Array<Token> {
  let mode = 'char';
  let currentWord = '';
  let currentAtomicTag = '';
  const words = [];
  for (let i = 0; i < html.length; i++) {
    const char = html[i];
    switch (mode) {
      case 'tag': {
        const atomicTag = isStartOfAtomicTag(currentWord);
        if (atomicTag) {
          mode = 'atomic_tag';
          currentAtomicTag = atomicTag;
          currentWord += char;
        } else if (isStartofHTMLComment(currentWord)) {
          mode = 'html_comment';
          currentWord += char;
        } else if (isEndOfTag(char)) {
          currentWord += '>';
          words.push(createToken(currentWord));
          currentWord = '';
          if (isWhitespace(char)) {
            mode = 'whitespace';
          } else {
            mode = 'char';
          }
        } else {
          currentWord += char;
        }
        break;
      }
      case 'atomic_tag':
        if (
          isEndOfTag(char) &&
          isEndOfAtomicTag(currentWord, currentAtomicTag)
        ) {
          currentWord += '>';
          words.push(createToken(currentWord));
          currentWord = '';
          currentAtomicTag = '';
          mode = 'char';
        } else {
          currentWord += char;
        }
        break;
      case 'html_comment':
        currentWord += char;
        if (isEndOfHTMLComment(currentWord)) {
          currentWord = '';
          mode = 'char';
        }
        break;
      case 'char':
        if (isStartOfTag(char)) {
          if (currentWord) {
            words.push(createToken(currentWord));
          }
          currentWord = '<';
          mode = 'tag';
        } else if (/\s/.test(char)) {
          if (currentWord) {
            words.push(createToken(currentWord));
          }
          currentWord = char;
          mode = 'whitespace';
        } else if (/[\w\d#@]/.test(char)) {
          currentWord += char;
        } else if (/&/.test(char)) {
          if (currentWord) {
            words.push(createToken(currentWord));
          }
          currentWord = char;
        } else {
          currentWord += char;
          words.push(createToken(currentWord));
          currentWord = '';
        }
        break;
      case 'whitespace':
        if (isStartOfTag(char)) {
          if (currentWord) {
            words.push(createToken(currentWord));
          }
          currentWord = '<';
          mode = 'tag';
        } else if (isWhitespace(char)) {
          currentWord += char;
        } else {
          if (currentWord) {
            words.push(createToken(currentWord));
          }
          currentWord = char;
          mode = 'char';
        }
        break;
      default:
        throw new Error(`Unknown mode ${mode}`);
    }
  }
  if (currentWord) {
    words.push(createToken(currentWord));
  }

  return words;
}

/**
 * Creates a key that should be used to match tokens. This is useful, for example, if we want
 * to consider two open tag tokens as equal, even if they don't have the same attributes. We
 * use a key instead of overwriting the token because we may want to render the original string
 * without losing the attributes.
 *
 * @param {string} token The token to create the key for.
 *
 * @return {string} The identifying key that should be used to match before and after tokens.
 */
function getKeyForToken(token: string): string {
  const tagName = /<([^\s>]+)[\s>]/.exec(token);
  if (tagName) {
    return `<${tagName[1].toLowerCase()}>`;
  }
  return token && token.replace(/(\s+|&nbsp;|&#160;)/g, ' ');
}

/**
 * Creates a map from token key to an array of indices of locations of the matching token in
 * the list of all tokens.
 *
 * @param {Array.<Token>} tokens The list of tokens to be mapped.
 *
 * @return {Object} A mapping that can be used to search for tokens.
 */
function createMap(tokens: Array<Token>): object {
  return tokens.reduce(function (map, token, index) {
    if (map[token.key]) {
      map[token.key].push(index);
    } else {
      map[token.key] = [index];
    }
    return map;
  }, Object.create(null));
}

/**
 * Compares two match objects to determine if the second match object comes before or after the
 * first match object. Returns -1 if the m2 should come before m1. Returns 1 if m1 should come
 * before m2. If the two matches criss-cross each other, a null is returned.
 *
 * @param {MatchT} m1 The first match object to compare.
 * @param {MatchT} m2 The second match object to compare.
 *
 * @return {number} Returns -1 if the m2 should come before m1. Returns 1 if m1 should come
 *    before m2. If the two matches criss-cross each other, 0 is returned.
 */
function compareMatches(m1: MatchT, m2: MatchT): number {
  if (m2.endInBefore < m1.startInBefore && m2.endInAfter < m1.startInAfter) {
    return -1;
  } else if (
    m2.startInBefore > m1.endInBefore &&
    m2.startInAfter > m1.endInAfter
  ) {
    return 1;
  } else {
    return 0;
  }
}

/**
 * A constructor for a binary search tree used to keep match objects in the proper order as
 * they're found.
 *
 * @constructor
 */
function MatchBinarySearchTree() {
  this._root = null;
}

MatchBinarySearchTree.prototype = {
  /**
   * Adds matches to the binary search tree.
   *
   * @param {MatchT} value The match to add to the binary search tree.
   */
  add(value: MatchT) {
    // Create the node to hold the match value.
    const node = {
      value,
      left: null,
      right: null,
    };

    let current = this._root;
    if (current) {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Determine if the match value should go to the left or right of the current
        // node.
        const position = compareMatches(current.value, value);
        if (position === -1) {
          // The position of the match is to the left of this node.
          if (current.left) {
            current = current.left;
          } else {
            current.left = node;
            break;
          }
        } else if (position === 1) {
          // The position of the match is to the right of this node.
          if (current.right) {
            current = current.right;
          } else {
            current.right = node;
            break;
          }
        } else {
          // If 0 was returned from compareMatches, that means the node cannot
          // be inserted because it overlaps an existing node.
          break;
        }
      }
    } else {
      // If no nodes exist in the tree, make this the root node.
      this._root = node;
    }
  },

  /**
   * Converts the binary search tree into an array using an in-order traversal.
   *
   * @return {Array.<MatchT>} An array containing the matches in the binary search tree.
   */
  toArray(): Array<MatchT> {
    interface Node {
      value: MatchT;
      left: Node;
      right: Node;
    }

    function inOrder(node: Node, nodes: MatchT[]) {
      if (node) {
        inOrder(node.left, nodes);
        nodes.push(node.value);
        inOrder(node.right, nodes);
      }
      return nodes;
    }

    return inOrder(this._root, []);
  },
};

/**
 * Finds and returns the best match between the before and after arrays contained in the segment
 * provided.
 *
 * @param {Segment} segment The segment in which to look for a match.
 *
 * @return {MatchT} The best match.
 */
function findBestMatch(segment: Segment): MatchT | null {
  const beforeTokens = segment.beforeTokens;
  const afterMap = segment.afterMap;
  let lastSpace = null;
  let bestMatch: MatchT | null = null;

  // Iterate through the entirety of the beforeTokens to find the best match.
  for (let beforeIndex = 0; beforeIndex < beforeTokens.length; beforeIndex++) {
    let lookBehind = false;

    // If the current best match is longer than the remaining tokens, we can bail because we
    // won't find a better match.
    const remainingTokens = beforeTokens.length - beforeIndex;
    if (bestMatch && remainingTokens < (bestMatch as MatchT).length) {
      break;
    }

    // If the current token is whitespace, make a note of it and move on. Trying to start a
    // set of matches with whitespace is not efficient because it's too prevelant in most
    // documents. Instead, if the next token yields a match, we'll see if the whitespace can
    // be included in that match.
    const beforeToken = beforeTokens[beforeIndex];
    if (beforeToken.key === ' ') {
      lastSpace = beforeIndex;
      continue;
    }

    // Check to see if we just skipped a space, if so, we'll ask getFullMatch to look behind
    // by one token to see if it can include the whitespace.
    if (lastSpace === beforeIndex - 1) {
      lookBehind = true;
    }

    // If the current token is not found in the afterTokens, it won't match and we can move
    // on.
    const afterTokenLocations = afterMap[beforeToken.key];
    if (!afterTokenLocations) {
      continue;
    }

    // For each instance of the current token in afterTokens, let's see how big of a match
    // we can build.
    afterTokenLocations.forEach(function (afterIndex: number) {
      // getFullMatch will see how far the current token match will go in both
      // beforeTokens and afterTokens.
      const bestMatchLength = bestMatch ? bestMatch.length : 0;
      const match = getFullMatch(
        segment,
        beforeIndex,
        afterIndex,
        bestMatchLength,
        lookBehind,
      );

      // If we got a new best match, we'll save it aside.
      if (match && match.length > bestMatchLength) {
        bestMatch = match;
      }
    });
  }

  return bestMatch;
}

/**
 * Takes the start of a match, and expands it in the beforeTokens and afterTokens of the
 * current segment as far as it can go.
 *
 * @param {Segment} segment The segment object to search within when expanding the match.
 * @param {number} beforeStart The offset within beforeTokens to start looking.
 * @param {number} afterStart The offset within afterTokens to start looking.
 * @param {number} minLength The minimum length match that must be found.
 * @param {boolean} lookBehind If true, attempt to match a whitespace token just before the
 *    beforeStart and afterStart tokens.
 *
 * @return {MatchT} The full match.
 */
function getFullMatch(
  segment: Segment,
  beforeStart: number,
  afterStart: number,
  minLength: number,
  lookBehind: boolean,
): MatchT | undefined {
  const beforeTokens = segment.beforeTokens;
  const afterTokens = segment.afterTokens;

  // If we already have a match that goes to the end of the document, no need to keep looking.
  const minBeforeIndex = beforeStart + minLength;
  const minAfterIndex = afterStart + minLength;
  if (
    minBeforeIndex >= beforeTokens.length ||
    minAfterIndex >= afterTokens.length
  ) {
    return;
  }

  // If a minLength was provided, we can do a quick check to see if the tokens after that
  // length match. If not, we won't be beating the previous best match, and we can bail out
  // early.
  if (minLength) {
    const nextBeforeWord = beforeTokens[minBeforeIndex].key;
    const nextAfterWord = afterTokens[minAfterIndex].key;
    if (nextBeforeWord !== nextAfterWord) {
      return;
    }
  }

  // Extend the current match as far foward as it can go, without overflowing beforeTokens or
  // afterTokens.
  let searching = true;
  let currentLength = 1;
  let beforeIndex = beforeStart + currentLength;
  let afterIndex = afterStart + currentLength;

  while (
    searching &&
    beforeIndex < beforeTokens.length &&
    afterIndex < afterTokens.length
  ) {
    const beforeWord = beforeTokens[beforeIndex].key;
    const afterWord = afterTokens[afterIndex].key;
    if (beforeWord === afterWord) {
      currentLength++;
      beforeIndex = beforeStart + currentLength;
      afterIndex = afterStart + currentLength;
    } else {
      searching = false;
    }
  }

  // If we've been asked to look behind, it's because both beforeTokens and afterTokens may
  // have a whitespace token just behind the current match that was previously ignored. If so,
  // we'll expand the current match to include it.
  if (lookBehind && beforeStart > 0 && afterStart > 0) {
    const prevBeforeKey = beforeTokens[beforeStart - 1].key;
    const prevAfterKey = afterTokens[afterStart - 1].key;
    if (prevBeforeKey === ' ' && prevAfterKey === ' ') {
      beforeStart--;
      afterStart--;
      currentLength++;
    }
  }

  return new Match(beforeStart, afterStart, currentLength, segment);
}

/**
 * Creates segment objects from the original document that can be used to restrict the area that
 * findBestMatch and it's helper functions search to increase performance.
 *
 * @param {Array.<Token>} beforeTokens Tokens from the before document.
 * @param {Array.<Token>} afterTokens Tokens from the after document.
 * @param {number} beforeIndex The index within the before document where this segment begins.
 * @param {number} afterIndex The index within the after document where this segment behinds.
 *
 * @return {Segment} The segment object.
 */
function createSegment(
  beforeTokens: Array<Token>,
  afterTokens: Array<Token>,
  beforeIndex: number,
  afterIndex: number,
): Segment {
  return {
    beforeTokens,
    afterTokens,
    beforeMap: createMap(beforeTokens),
    afterMap: createMap(afterTokens),
    beforeIndex,
    afterIndex,
  };
}

/**
 * Finds all the matching blocks within the given segment in the before and after lists of
 * tokens.
 *
 * @param {Segment} The segment that should be searched for matching blocks.
 *
 * @return {Array.<Match>} The list of matching blocks in this range.
 */
function findMatchingBlocks(segment: Segment): Array<MatchT> {
  // Create a binary search tree to hold the matches we find in order.
  const matches = new MatchBinarySearchTree();
  let match;
  const segments: Segment[] = [segment];

  // Each time the best match is found in a segment, zero, one or two new segments may be
  // created from the parts of the original segment not included in the match. We will
  // continue to iterate until all segments have been processed.
  while (segments.length) {
    segment = segments.pop() as Segment;
    match = findBestMatch(segment);

    if (match && match.length) {
      // If there's an unmatched area at the start of the segment, create a new segment
      // from that area and throw it into the segments array to get processed.
      if (match.segmentStartInBefore > 0 && match.segmentStartInAfter > 0) {
        const leftBeforeTokens = segment.beforeTokens.slice(
          0,
          match.segmentStartInBefore,
        );
        const leftAfterTokens = segment.afterTokens.slice(
          0,
          match.segmentStartInAfter,
        );

        segments.push(
          createSegment(
            leftBeforeTokens,
            leftAfterTokens,
            segment.beforeIndex,
            segment.afterIndex,
          ),
        );
      }

      // If there's an unmatched area at the end of the segment, create a new segment from that
      // area and throw it into the segments array to get processed.
      const rightBeforeTokens = segment.beforeTokens.slice(
        match.segmentEndInBefore + 1,
      );
      const rightAfterTokens = segment.afterTokens.slice(
        match.segmentEndInAfter + 1,
      );
      const rightBeforeIndex =
        segment.beforeIndex + match.segmentEndInBefore + 1;
      const rightAfterIndex = segment.afterIndex + match.segmentEndInAfter + 1;

      if (rightBeforeTokens.length && rightAfterTokens.length) {
        segments.push(
          createSegment(
            rightBeforeTokens,
            rightAfterTokens,
            rightBeforeIndex,
            rightAfterIndex,
          ),
        );
      }

      matches.add(match);
    }
  }

  return matches.toArray();
}

/**
 * Gets a list of operations required to transform the before list of tokens into the
 * after list of tokens. An operation describes whether a particular list of consecutive
 * tokens are equal, replaced, inserted, or deleted.
 *
 * @param {Array.<string>} beforeTokens The before list of tokens.
 * @param {Array.<string>} afterTokens The after list of tokens.
 *
 * @return {Array.<Object>} The list of operations to transform the before list of
 *      tokens into the after list of tokens, where each operation has the following
 *      keys:
 *      - {string} action One of {'replace', 'insert', 'delete', 'equal'}.
 *      - {number} startInBefore The beginning of the range in the list of before tokens.
 *      - {number} endInBefore The end of the range in the list of before tokens.
 *      - {number} startInAfter The beginning of the range in the list of after tokens.
 *      - {number} endInAfter The end of the range in the list of after tokens.
 */
function calculateOperations(
  beforeTokens: Array<Token>,
  afterTokens: Array<Token>,
): Array<Operation> {
  if (!beforeTokens) {
    throw new Error('Missing beforeTokens');
  }
  if (!afterTokens) {
    throw new Error('Missing afterTokens');
  }

  let positionInBefore = 0;
  let positionInAfter = 0;
  const operations: Operation[] = [];
  const segment = createSegment(beforeTokens, afterTokens, 0, 0);
  const matches = findMatchingBlocks(segment);

  matches.push(new Match(beforeTokens.length, afterTokens.length, 0, segment));

  for (let index = 0; index < matches.length; index++) {
    const match = matches[index];
    let actionUpToMatchPositions: OperationType = 'none';
    if (positionInBefore === match.startInBefore) {
      if (positionInAfter !== match.startInAfter) {
        actionUpToMatchPositions = 'insert';
      }
    } else {
      actionUpToMatchPositions = 'delete';
      if (positionInAfter !== match.startInAfter) {
        actionUpToMatchPositions = 'replace';
      }
    }
    if (actionUpToMatchPositions !== 'none') {
      operations.push({
        action: actionUpToMatchPositions,
        startInBefore: positionInBefore,
        endInBefore:
          actionUpToMatchPositions !== 'insert'
            ? match.startInBefore - 1
            : null,
        startInAfter: positionInAfter,
        endInAfter:
          actionUpToMatchPositions !== 'delete' ? match.startInAfter - 1 : null,
      });
    }
    if (match.length !== 0) {
      operations.push({
        action: 'equal',
        startInBefore: match.startInBefore,
        endInBefore: match.endInBefore,
        startInAfter: match.startInAfter,
        endInAfter: match.endInAfter,
      });
    }
    positionInBefore = match.endInBefore + 1;
    positionInAfter = match.endInAfter + 1;
  }

  const postProcessed = [];
  let lastOp = { action: 'none' } as Operation;

  function isSingleWhitespace(op: Operation) {
    if (op.action !== 'equal') {
      return false;
    }
    if ((op.endInBefore ?? 0) - op.startInBefore !== 0) {
      return false;
    }
    return /^\s$/.test(
      // @ts-expect-error Not sure why the code slices here
      beforeTokens.slice(op.startInBefore, op.endInBefore + 1),
    );
  }

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];

    if (
      (isSingleWhitespace(op) && lastOp.action === 'replace') ||
      (op.action === 'replace' && lastOp.action === 'replace')
    ) {
      lastOp.endInBefore = op.endInBefore;
      lastOp.endInAfter = op.endInAfter;
    } else {
      postProcessed.push(op as Operation);
      lastOp = op;
    }
  }
  return postProcessed;
}

/**
 * A TokenWrapper provides a utility for grouping segments of tokens based on whether they're
 * wrappable or not. A tag is considered wrappable if it is closed within the given set of
 * tokens. For example, given the following tokens:
 *
 *      ['</b>', 'this', ' ', 'is', ' ', 'a', ' ', '<b>', 'test', '</b>', '!']
 *
 * The first '</b>' is not considered wrappable since the tag is not fully contained within the
 * array of tokens. The '<b>', 'test', and '</b>' would be a part of the same wrappable segment
 * since the entire bold tag is within the set of tokens.
 *
 * TokenWrapper has a method 'combine' which allows walking over the segments to wrap them in
 * tags.
 */
function TokenWrapper(tokens: any) {
  this.tokens = tokens;
  this.notes = tokens.reduce(
    function (data: any, token: any, index: number) {
      data.notes.push({
        isWrappable: isWrappable(token),
        insertedTag: false,
      });

      const tag = !isVoidTag(token) && isTag(token);
      const lastEntry = data.tagStack[data.tagStack.length - 1];
      if (tag) {
        if (lastEntry && `/${lastEntry.tag}` === tag) {
          data.notes[lastEntry.position].insertedTag = true;
          data.tagStack.pop();
        } else {
          data.tagStack.push({
            tag,
            position: index,
          });
        }
      }
      return data;
    },
    { notes: [], tagStack: [] },
  ).notes;
}

/**
 * Wraps the contained tokens in tags based on output given by a map function. Each segment of
 * tokens will be visited. A segment is a continuous run of either all wrappable
 * tokens or unwrappable tokens. The given map function will be called with each segment of
 * tokens and the resulting strings will be combined to form the wrapped HTML.
 *
 * @param {function(boolean, Array.<string>)} mapFn A function called with an array of tokens
 *      and whether those tokens are wrappable or not. The result should be a string.
 */
TokenWrapper.prototype.combine = function (
  mapFn: (wrappable: boolean, tokens: Array<Token>) => void,
  tagFn: (tokens: Array<Token>) => void,
) {
  const notes = this.notes;
  const tokens = this.tokens.slice();
  const segments = tokens.reduce(
    function (data: any, _token: Token, index: number) {
      if (notes[index].insertedTag) {
        tokens[index] = tagFn(tokens[index]);
      }
      if (data.status === null) {
        data.status = notes[index].isWrappable;
      }
      const status = notes[index].isWrappable;
      if (status !== data.status) {
        data.list.push({
          isWrappable: data.status,
          tokens: tokens.slice(data.lastIndex, index),
        });
        data.lastIndex = index;
        data.status = status;
      }
      if (index === tokens.length - 1) {
        data.list.push({
          isWrappable: data.status,
          tokens: tokens.slice(data.lastIndex, index + 1),
        });
      }
      return data;
    },
    { list: [], status: null, lastIndex: 0 },
  ).list;

  return segments.map(mapFn).join('');
};

/**
 * Wraps and concatenates a list of tokens with a tag. Does not wrap tag tokens,
 * unless they are wrappable (i.e. void and atomic tags).
 *
 * @param {string} tag The tag name of the wrapper tags.
 * @param {Array.<string>} content The list of tokens to wrap.
 * @param {string} dataPrefix (Optional) The prefix to use in data attributes.
 * @param {string} className (Optional) The class name to include in the wrapper tag.
 */
function wrap(
  tag: string,
  content: Array<string>,
  opIndex: number,
  dataPrefix: string,
  className: string,
) {
  const wrapper = new TokenWrapper(content);
  dataPrefix = dataPrefix ? `${dataPrefix}-` : '';
  let attrs = ` data-${dataPrefix}operation-index="${opIndex}"`;
  if (className) {
    attrs += ` class="${className}"`;
  }

  return wrapper.combine(
    function (segment: any) {
      if (segment.isWrappable) {
        const val = segment.tokens.join('');
        if (val.trim()) {
          return `<${tag}${attrs}>${val}</${tag}>`;
        }
      } else {
        return segment.tokens.join('');
      }
      return '';
    },
    function (openingTag: string) {
      let dataAttrs = ` data-diff-node="${tag}"`;
      dataAttrs += ` data-${dataPrefix}operation-index="${opIndex}"`;

      return openingTag.replace(/>\s*$/, `${dataAttrs}$&`);
    },
  );
}

/**
 * OPS.equal/insert/delete/replace are functions that render an operation into
 * HTML content.
 *
 * @param {Operation} op The operation that applies to a particular list of tokens.
 * @param {Array.<Token>} beforeTokens The before list of tokens.
 * @param {Array.<Token>} afterTokens The after list of tokens.
 * @param {number} opIndex The index into the list of operations that identifies the change to
 *      be rendered. This is used to mark wrapped HTML as part of the same operation.
 * @param {string} dataPrefix (Optional) The prefix to use in data attributes.
 * @param {string} className (Optional) The class name to include in the wrapper tag.
 *
 * @return {string} The rendering of that operation.
 */
const OPS = {
  equal(op: Operation, _beforeTokens: Token[], afterTokens: Token[]) {
    const tokens = afterTokens.slice(
      op.startInAfter ?? 0,
      (op.endInAfter ?? 0) + 1,
    );
    return tokens.reduce(function (prev, curr) {
      return prev + curr.string;
    }, '');
  },
  insert(
    op: Operation,
    _beforeTokens: Token[],
    afterTokens: Token[],
    opIndex: number,
    dataPrefix: string,
    className: string,
  ) {
    const tokens = afterTokens.slice(
      op.startInAfter ?? 0,
      (op.endInAfter ?? 0) + 1,
    );
    const val = tokens.map(function (token) {
      return token.string;
    });
    return wrap('ins', val, opIndex, dataPrefix, className);
  },
  delete(
    op: Operation,
    beforeTokens: Token[],
    _afterTokens: Token[],
    opIndex: number,
    dataPrefix: string,
    className: string,
  ) {
    const tokens = beforeTokens.slice(
      op.startInBefore,
      (op.endInBefore ?? 0) + 1,
    );
    const val = tokens.map(function (token) {
      return token.string;
    });
    return wrap('del', val, opIndex, dataPrefix, className);
  },
  replace(...rest: any[]) {
    return OPS.delete.apply(null, rest) + OPS.insert.apply(null, rest);
  },
};

/**
 * Renders a list of operations into HTML content. The result is the combined version
 * of the before and after tokens with the differences wrapped in tags.
 *
 * @param {Array.<Token>} beforeTokens The before list of tokens.
 * @param {Array.<Token>} afterTokens The after list of tokens.
 * @param {Array.<Operation>} operations The list of operations to transform the before
 *      list of tokens into the after list of tokens;
 * @param {string} dataPrefix (Optional) The prefix to use in data attributes.
 * @param {string} className (Optional) The class name to include in the wrapper tag.
 *
 * @return {string} The rendering of the list of operations.
 */
function renderOperations(
  beforeTokens: Token[],
  afterTokens: Token[],
  operations: Operation[],
  dataPrefix?: string,
  className?: string,
): string {
  return operations.reduce(function (rendering, op, index) {
    return (
      rendering +
      OPS[op.action](
        op,
        beforeTokens,
        afterTokens,
        index,
        dataPrefix,
        className,
      )
    );
  }, '');
}

/**
 * Compares two pieces of HTML content and returns the combined content with differences
 * wrapped in <ins> and <del> tags.
 *
 * @param {string} before The HTML content before the changes.
 * @param {string} after The HTML content after the changes.
 * @param {string} className (Optional) The class attribute to include in <ins> and <del> tags.
 * @param {string} dataPrefix (Optional) The data prefix to use for data attributes. The
 *      operation index data attribute will be named `data-${dataPrefix-}operation-index`.
 *
 * @return {string} The combined HTML content with differences wrapped in <ins> and <del> tags.
 */
function diff(
  before: string,
  after: string,
  className?: string,
  dataPrefix?: string,
): string {
  if (before === after) {
    return before;
  }

  const beforeTokens = htmlToTokens(before);
  const afterTokens = htmlToTokens(after);
  const ops = calculateOperations(beforeTokens, afterTokens);

  return renderOperations(
    beforeTokens,
    afterTokens,
    ops,
    dataPrefix,
    className,
  );
}

export default diff;
