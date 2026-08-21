import { isPermissionCode, type PermissionCode } from "@/lib/admin/permissions";
import type { HelpArticle, HelpArticleInput, HelpCenterPayload, HelpProfile } from "@/lib/help/types";
import { generatedId, permissionsFor } from "@/lib/server/admin";
import { ApiError, database, me, platformOwnerSession } from "@/lib/server/auth";

type ArticleRow = {
  id:number; tenant_id:number|null; slug:string; title:string; summary:string; content:string; category:string; display_order:number;
  target_profiles:string; required_permission:string|null; related_route:string|null; published:number; is_new_feature:number;
  released_at:string|null; version:string; updated_at:string; read_at:string|null;
};

const safeText=(value:unknown,label:string,max:number,required=true)=>{
  const text=typeof value==="string"?value.trim():"";
  if(required&&!text)throw new ApiError(400,"DADOS_INVALIDOS",`Informe ${label}.`);
  if(text.length>max)throw new ApiError(400,"DADOS_INVALIDOS",`${label} excede o limite permitido.`);
  return text;
};
const profiles:HelpProfile[]=["TODOS","USUARIO","ADMIN_FILIAL","ADMIN_MATRIZ","ADMIN_CONVENCAO","PLATFORM_OWNER"];
function profileFor(session:Awaited<ReturnType<typeof me>>):HelpProfile{
  if(session.user.isPlatformOwner)return "PLATFORM_OWNER";
  if(!session.user.roleName.toLocaleLowerCase("pt-BR").includes("administrador"))return "USUARIO";
  return session.user.organizationalScope==="CONVENCAO"?"ADMIN_CONVENCAO":session.user.organizationalScope==="MATRIZ"?"ADMIN_MATRIZ":"ADMIN_FILIAL";
}
function map(row:ArticleRow):HelpArticle{
  let targetProfiles:HelpProfile[]=["TODOS"];
  try{const parsed=JSON.parse(row.target_profiles);if(Array.isArray(parsed))targetProfiles=parsed.filter((x):x is HelpProfile=>profiles.includes(x));}catch{}
  return {id:row.id,slug:row.slug,title:row.title,summary:row.summary,content:row.content,category:row.category,displayOrder:row.display_order,targetProfiles,
    requiredPermission:isPermissionCode(row.required_permission)?row.required_permission:null,relatedRoute:row.related_route,published:Boolean(row.published),
    isNewFeature:Boolean(row.is_new_feature),releasedAt:row.released_at,version:row.version,read:Boolean(row.read_at),tenantSpecific:row.tenant_id!==null,updatedAt:row.updated_at};
}

export async function helpCenter(request:Request):Promise<HelpCenterPayload>{
  const session=await me(request); const profile=profileFor(session);
  const permissions=new Set<PermissionCode>(session.user.isPlatformOwner?[]:await permissionsFor(session.user.membershipId,session.user.id));
  const tenantId=session.activeTenant?.id??null;
  const result=await database().prepare(`SELECT a.*,r.viewed_at read_at FROM help_articles a LEFT JOIN help_article_reads r ON r.article_id=a.id AND r.user_id=? WHERE a.published=1 AND (a.tenant_id IS NULL${tenantId?" OR a.tenant_id=?":""}) ORDER BY a.is_new_feature DESC,a.released_at DESC,a.display_order,a.title`).bind(session.user.id,...(tenantId?[tenantId]:[])).all<ArticleRow>();
  const articles=result.results.map(map).filter(article=>{
    const profileAllowed=article.targetProfiles.includes("TODOS")||article.targetProfiles.includes(profile);
    const permissionAllowed=!article.requiredPermission||session.user.isPlatformOwner||permissions.has(article.requiredPermission);
    return profileAllowed&&permissionAllowed;
  });
  return {articles,categories:[...new Set(articles.map(x=>x.category))],unreadNews:articles.filter(x=>x.isNewFeature&&!x.read).length,profile,canManage:session.user.isPlatformOwner};
}

export async function markHelpRead(request:Request,id:number){
  const session=await me(request);
  const allowed=(await helpCenter(request)).articles.some(article=>article.id===id);
  if(!allowed)throw new ApiError(404,"ARTIGO_NAO_ENCONTRADO","Artigo não encontrado.");
  await database().prepare("INSERT INTO help_article_reads(user_id,article_id,viewed_at) VALUES(?,?,?) ON CONFLICT(user_id,article_id) DO UPDATE SET viewed_at=excluded.viewed_at").bind(session.user.id,id,new Date().toISOString()).run();
}

function normalizedInput(input:HelpArticleInput){
  const targetProfiles=Array.isArray(input.targetProfiles)?input.targetProfiles.filter((x):x is HelpProfile=>typeof x==="string"&&profiles.includes(x as HelpProfile)):[];
  const permission=input.requiredPermission?String(input.requiredPermission):null;
  if(permission&&!isPermissionCode(permission))throw new ApiError(400,"DADOS_INVALIDOS","Permissão relacionada inválida.");
  const route=safeText(input.relatedRoute,"a rota relacionada",200,false)||null;
  if(route&&!route.startsWith("/painel"))throw new ApiError(400,"DADOS_INVALIDOS","A rota relacionada deve pertencer ao painel.");
  return {title:safeText(input.title,"o título",160),slug:safeText(input.slug,"o identificador",100).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""),summary:safeText(input.summary,"o resumo",360),content:safeText(input.content,"o conteúdo",12000),category:safeText(input.category,"a categoria",80),displayOrder:Math.max(0,Math.min(9999,Number(input.displayOrder)||0)),targetProfiles:targetProfiles.length?targetProfiles:["TODOS"],requiredPermission:permission,relatedRoute:route,published:input.published!==false,isNewFeature:Boolean(input.isNewFeature),releasedAt:safeText(input.releasedAt,"a data",30,false)||null,version:safeText(input.version,"a versão",30,false)||"1.0"};
}

export async function createHelpArticle(request:Request,input:HelpArticleInput){
  const owner=await platformOwnerSession(request); const v=normalizedInput(input); const now=new Date().toISOString(),id=generatedId();
  if(!owner.user.isPlatformOwner)throw new ApiError(403,"PERMISSAO_NEGADA","Somente o proprietário da plataforma pode administrar a Central de Ajuda.");
  await database().prepare("INSERT INTO help_articles(id,tenant_id,slug,title,summary,content,category,display_order,target_profiles,required_permission,related_route,published,is_new_feature,released_at,version,created_by_user_id,published_at,created_at,updated_at) VALUES(?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,v.slug,v.title,v.summary,v.content,v.category,v.displayOrder,JSON.stringify(v.targetProfiles),v.requiredPermission,v.relatedRoute,v.published?1:0,v.isNewFeature?1:0,v.releasedAt,v.version,owner.user.id,v.published?now:null,now,now).run();
  return {id};
}

export async function updateHelpArticle(request:Request,id:number,input:HelpArticleInput){
  const owner=await platformOwnerSession(request);if(!owner.user.isPlatformOwner)throw new ApiError(403,"PERMISSAO_NEGADA","Somente o proprietário da plataforma pode administrar a Central de Ajuda.");const v=normalizedInput(input),now=new Date().toISOString();
  const found=await database().prepare("SELECT id FROM help_articles WHERE id=?").bind(id).first();if(!found)throw new ApiError(404,"ARTIGO_NAO_ENCONTRADO","Artigo não encontrado.");
  await database().prepare("UPDATE help_articles SET slug=?,title=?,summary=?,content=?,category=?,display_order=?,target_profiles=?,required_permission=?,related_route=?,published=?,is_new_feature=?,released_at=?,version=?,published_at=CASE WHEN ?=1 THEN COALESCE(published_at,?) ELSE NULL END,updated_at=? WHERE id=?").bind(v.slug,v.title,v.summary,v.content,v.category,v.displayOrder,JSON.stringify(v.targetProfiles),v.requiredPermission,v.relatedRoute,v.published?1:0,v.isNewFeature?1:0,v.releasedAt,v.version,v.published?1:0,now,now,id).run();
}
