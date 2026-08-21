export const REPORT_TYPES = [
  "OFICIAL_CAIXA",
  "ENTRADAS",
  "SAIDAS",
  "CONTRIBUICOES",
  "RATEIO",
  "CAMPANHAS_FUNDOS",
] as const;

export type FinanceReportType = (typeof REPORT_TYPES)[number];

export const REPORT_BLOCKS = [
  "LOGO","TITULO","SUBTITULO","DADOS_INSTITUICAO","UNIDADE","COMPETENCIA",
  "SALDO_ANTERIOR","ENTRADAS","FORA_RATEIO","BASE_RATEIO","DIVISOES","SAIDAS",
  "SALDO_ATUAL","RECURSOS_VINCULADOS","PARCELA_PROPRIA","TOTAL_REPASSE","JA_REPASSADO","PENDENTE_REPASSE","VALORES_REPASSAR","SALDO_LIVRE",
  "OBSERVACOES","ASSINATURAS","GERADO_POR","DATA_HORA","NUMERO_PAGINA","TEXTO_PERSONALIZADO",
] as const;

export type FinanceReportBlockKey = (typeof REPORT_BLOCKS)[number];
export type ReportBlock = { key: FinanceReportBlockKey; label: string; visible: boolean };

export const DEFAULT_REPORT_BLOCKS: ReportBlock[] = [
  ["LOGO","Logo",true],["TITULO","Prestação de Contas Financeira",true],["SUBTITULO","",false],
  ["DADOS_INSTITUICAO","Dados da instituição",true],["UNIDADE","Unidade",true],["COMPETENCIA","Competência",true],
  ["SALDO_ANTERIOR","Saldo anterior",true],["ENTRADAS","Entradas",true],["FORA_RATEIO","Recursos fora do rateio",true],
  ["BASE_RATEIO","Base do rateio",true],["DIVISOES","Distribuição mensal",true],["SAIDAS","Saídas",true],
  ["SALDO_ATUAL","Saldo financeiro atual",true],["RECURSOS_VINCULADOS","Recursos vinculados",true],
  ["PARCELA_PROPRIA","Parcela destinada à própria unidade",true],["TOTAL_REPASSE","Total calculado para repasse",true],
  ["JA_REPASSADO","Já repassado",true],["PENDENTE_REPASSE","Pendente de repasse",true],
  ["VALORES_REPASSAR","Comprometido / A repassar",false],["SALDO_LIVRE","Saldo livre disponível",true],
  ["OBSERVACOES","Observações",false],["ASSINATURAS","Assinaturas",true],["GERADO_POR","Gerado por",true],
  ["DATA_HORA","Data e hora",true],["NUMERO_PAGINA","Número da página",true],["TEXTO_PERSONALIZADO","",false],
].map(([key,label,visible])=>({key:key as FinanceReportBlockKey,label:String(label),visible:Boolean(visible)}));

export function isFinanceReportType(value: unknown): value is FinanceReportType {
  return typeof value === "string" && (REPORT_TYPES as readonly string[]).includes(value);
}

export function normalizeReportBlocks(value: unknown): ReportBlock[] {
  if (!Array.isArray(value)) return DEFAULT_REPORT_BLOCKS.map(block=>({...block}));
  const seen = new Set<string>();
  const blocks: ReportBlock[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const input = candidate as Record<string,unknown>;
    const key = typeof input.key === "string" ? input.key : "";
    if (!(REPORT_BLOCKS as readonly string[]).includes(key) || seen.has(key)) continue;
    seen.add(key);
    blocks.push({key:key as FinanceReportBlockKey,label:String(input.label??"").trim().slice(0,80),visible:input.visible!==false});
  }
  for (const fallback of DEFAULT_REPORT_BLOCKS) if (!seen.has(fallback.key)) blocks.push({...fallback});
  return blocks;
}

export function reportBalances(input:{
  openingCents:number;
  entriesCents:number;
  expensesCents:number;
  linkedCents:number;
  calculatedAllocationCents?:number;
  calculatedTransferCents?:number;
  transferredAllocationCents:number;
}) {
  const currentCents=input.openingCents+input.entriesCents-input.expensesCents;
  const calculatedTransferCents=input.calculatedTransferCents??input.calculatedAllocationCents??0;
  const remainingTransferCents=Math.max(0,calculatedTransferCents-input.transferredAllocationCents);
  const freeCents=currentCents-Math.max(0,input.linkedCents)-remainingTransferCents;
  return {currentCents,remainingTransferCents,freeCents};
}

export function publicContributorName(privacy:string,name:string|null|undefined){
  return privacy==="IDENTIFICADA"&&name?.trim()?name.trim():"Anônimo";
}
