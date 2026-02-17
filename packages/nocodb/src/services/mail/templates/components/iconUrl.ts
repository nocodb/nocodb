import { RelationTypes, UITypes } from 'nocodb-sdk';
import { NC_EMAIL_ASSETS_BASE_URL } from '~/constants';

// Default icon for unknown/unsupported types
const DEFAULT_ICON = 'SingleLineText';

// Map relation types to their specific icons
const RELATION_ICON_MAP: Record<RelationTypes, string> = {
  [RelationTypes.MANY_TO_MANY]: 'mm-solid',
  [RelationTypes.HAS_MANY]: 'hm-solid',
  [RelationTypes.BELONGS_TO]: 'bt-solid',
  [RelationTypes.ONE_TO_ONE]: 'oo-solid',
};

/**
 * Get the icon URL for a given UIType
 * For Links/LinkToAnotherRecord, uses relation-specific icons if relationType is provided
 * Falls back to SingleLineText icon for unknown types
 */
export function getFieldIconUrl(
  uidt: UITypes | string,
  relationType?: RelationTypes,
): string {
  // Handle relationship icons
  if (
    (uidt === UITypes.Links || uidt === UITypes.LinkToAnotherRecord) &&
    relationType
  ) {
    const relationIcon = RELATION_ICON_MAP[relationType];
    if (relationIcon) {
      return `${NC_EMAIL_ASSETS_BASE_URL}/icons/${relationIcon}.png`;
    }
  }

  const iconName = uidt || DEFAULT_ICON;
  return `${NC_EMAIL_ASSETS_BASE_URL}/icons/${iconName}.png`;
}
