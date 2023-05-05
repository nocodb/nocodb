export const mapTbl = {};

// static mapping records between aTblId && ncId
export const addToMappingTbl = function addToMappingTbl(
  aTblId,
  ncId,
  ncName,
  parent?,
) {
  mapTbl[aTblId] = {
    ncId: ncId,
    ncParent: parent,
    // name added to assist in quick debug
    ncName: ncName,
  };
};

// get NcID from airtable ID
export const getNcIdFromAtId = function getNcIdFromAtId(aId) {
  return mapTbl[aId]?.ncId;
};

// get nc Parent from airtable ID
export const getNcParentFromAtId = function getNcParentFromAtId(aId) {
  return mapTbl[aId]?.ncParent;
};

// get nc-title from airtable ID
export const getNcNameFromAtId = function getNcNameFromAtId(aId) {
  return mapTbl[aId]?.ncName;
};
