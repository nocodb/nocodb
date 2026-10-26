/** A link field in another base that deleting a base removes. */
export interface BaseDeleteLinkRef {
  base_id: string;
  base_title: string;
  table_id: string;
  table_title: string;
  field_id: string;
  field_title: string;
  /** The field's base is schema-locked (a managed-app install, or a production base with an open environment). */
  in_locked_base?: boolean;
}

/**
 * What deleting a base does to other bases. Only links the caller can read
 * are named; the rest are counted.
 */
export interface BaseDeletePreview {
  cross_base_links: BaseDeleteLinkRef[];
  hidden_cross_base_links: number;
  /** How many of the hidden ones sit in schema-locked bases. */
  hidden_locked_cross_base_links: number;
}
