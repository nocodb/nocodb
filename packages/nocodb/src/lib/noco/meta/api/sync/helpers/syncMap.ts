export const mapTbl = {};
exports.mapTbl = mapTbl;

// static mapping records between aTblId && ncId
export function addToMappingTbl(aTblId, ncId, ncName) {
  mapTbl[aTblId] = {
    ncId: ncId,

    // name added to assist in quick debug
    ncName: ncName
  };
}

// get NcID from airtable ID
export function getNcIdFromAtId(aId) {
  return mapTbl[aId]?.ncId;
}

// get nc-title from airtable ID
export function getNcNameFromAtId(aId) {
  return mapTbl[aId]?.ncName;
}
///////////////////////////////////////////////////////////////////////////////
