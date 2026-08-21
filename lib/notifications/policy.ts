type OrganizationalScope="CONVENCAO"|"MATRIZ"|"FILIAL";
export function canReceivePreRegistration(scope:OrganizationalScope,scopeUnitId:number,target:{matrixId:number|null;branchId:number|null;conventionId:number|null}):boolean{
  if(target.conventionId===null)return scope==="CONVENCAO";
  if(scope==="CONVENCAO")return scopeUnitId===target.conventionId;
  if(!target.matrixId)return false;
  if(scope==="MATRIZ")return scopeUnitId===target.matrixId;
  return target.branchId!==null&&scopeUnitId===target.branchId;
}
export function isSafeNotificationRoute(route:string|null):boolean{return route===null||(/^\/painel(?:\/|$)/.test(route)&&!route.startsWith("//")&&!route.includes("://"));}
export function notificationBadge(count:number):string{return count>99?"99+":String(Math.max(0,count));}
