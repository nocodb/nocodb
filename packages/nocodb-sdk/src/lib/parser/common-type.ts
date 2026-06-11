import { TokenType } from 'chevrotain';

export interface Token {
  image: string;
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  tokenTypeIdx: number;
  tokenType: TokenType[];
}

export interface Rule<T, N> {
  name: N;
  children: T;
}
