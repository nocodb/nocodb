export type LinkDbMappingInput =
  | {
      kind: 'bt';
      childTable: string;
      fkColumn: string;
      parentTable: string;
      parentPk: string;
    }
  | {
      kind: 'hm';
      childTable: string;
      fkColumn: string;
      parentTable: string;
      parentPk: string;
    }
  | {
      kind: 'mm';
      junctionTable: string;
      fkChildColumn: string;
      fkParentColumn: string;
    };

/**
 * Compact one-liner describing the underlying DB mapping of an LTAR field.
 * Seeded by meta sync into the Link field's `description` at insert time.
 *
 *   bt: "DB column: {childTable}.{fkColumn} → {parentTable}.{parentPk}"
 *   hm: "DB column: {parentTable}.{parentPk} ← {childTable}.{fkColumn}"
 *   mm: "Junction: {junctionTable}({fkChildColumn}, {fkParentColumn})"
 */
export function formatLinkDbMapping(input: LinkDbMappingInput): string {
  switch (input.kind) {
    case 'bt':
      return `DB column: ${input.childTable}.${input.fkColumn} → ${input.parentTable}.${input.parentPk}`;
    case 'hm':
      return `DB column: ${input.parentTable}.${input.parentPk} ← ${input.childTable}.${input.fkColumn}`;
    case 'mm':
      return `Junction: ${input.junctionTable}(${input.fkChildColumn}, ${input.fkParentColumn})`;
  }
}
