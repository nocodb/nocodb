let aTblNcMappingTbl = {}

// static mapping records between aTblId && ncId
exports.addToMappingTbl = function addToMappingTbl(aTblId, ncId, ncName) {
  aTblNcMappingTbl[aTblId] = {
    ncId: ncId,

    // name added to assist in quick debug
    ncName: ncName
  }
}

// get NcID from airtable ID
exports.getNcIdFromAtId = function getNcIdFromAtId(aId) {
  return aTblNcMappingTbl[aId]?.ncId
}

// get nc-title from airtable ID
exports.getNcNameFromAtId = function getNcNameFromAtId(aId) {
  return aTblNcMappingTbl[aId]?.ncName
}
///////////////////////////////////////////////////////////////////////////////