type OrganizationalScope="CONVENCAO"|"MATRIZ"|"FILIAL";
export function exportScopeClause(scope:OrganizationalScope,boundMatrixId:number|null,boundBranchId:number|null,alias="p"){
  if(scope==="MATRIZ")return {sql:` AND ${alias}.matrix_id=?`,bindings:[boundMatrixId]};
  if(scope==="FILIAL")return {sql:` AND ${alias}.branch_id=?`,bindings:[boundBranchId]};
  return {sql:"",bindings:[] as Array<number|null>};
}
export function canGenerateCompleteExport(scope:OrganizationalScope,isPlatformOwner:boolean){return isPlatformOwner||scope==="CONVENCAO";}
