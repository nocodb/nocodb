import { TokenType } from 'chevrotain';

export interface Token {
  image: string;
  startOffset: string;
  endOffset: string;
  startLine: string;
  endLine: string;
  startColumn: string;
  endColumn: string;
  tokenTypeIdx: string;
  tokenType: TokenType[];
}

export interface Rule<T, N> {
  name: N;
  children: T;
}
