export type FinancePrivacy = "ANONIMA" | "IDENTIFICADA" | "IDENTIFICADA_PRIVADA";
export type AllocationFinancialDestination = "REPASSAR" | "MANTER_NA_UNIDADE";

export function previousMonthCompetency(reference: Date): string {
  const year = reference.getUTCFullYear();
  const monthIndex = reference.getUTCMonth();
  const previous = new Date(Date.UTC(year, monthIndex - 1, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parseMoneyToCents(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value !== "string") throw new Error("VALOR_INVALIDO");
  const normalized = value.trim().replace(/\s/g, "").replace(/^R\$/i, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error("VALOR_INVALIDO");
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error("VALOR_INVALIDO");
  return cents;
}

export function splitInstallments(totalCents: number, count: number): number[] {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0 || !Number.isInteger(count) || count < 1 || count > 120) throw new Error("PARCELAMENTO_INVALIDO");
  const base = Math.floor(totalCents / count), remainder = totalCents % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function contributionIdentity(privacy: FinancePrivacy, personId: number | null) {
  if (privacy === "ANONIMA") return { personId: null, publicName: "Anônimo" };
  if (!personId) throw new Error("CONTRIBUINTE_OBRIGATORIO");
  return { personId, publicName: privacy === "IDENTIFICADA_PRIVADA" ? "Contribuinte privado" : null };
}

export function canTransfer(originAccountId: number, destinationAccountId: number, amountCents: number) {
  return Number.isInteger(originAccountId) && Number.isInteger(destinationAccountId) && originAccountId > 0 && destinationAccountId > 0 && originAccountId !== destinationAccountId && Number.isSafeInteger(amountCents) && amountCents > 0;
}

export function moneyDigitsToCents(value:string):number{
  const digits=value.replace(/\D/g,"");
  if(!digits)return 0;
  const cents=Number(digits);
  if(!Number.isSafeInteger(cents))throw new Error("VALOR_INVALIDO");
  return cents;
}

export function normalizePastedMoneyToCents(value:string):number{
  const cleaned=value.trim().replace(/^R\$\s*/i,"").replace(/\s/g,"");
  if(/^\d+$/.test(cleaned))return Number(cleaned)*100;
  return parseMoneyToCents(cleaned);
}

export function allocationPercentageStatus(rules:Array<{ruleType:string;percentageBasisPoints:number|null;active?:boolean}>){
  const active=rules.filter(rule=>rule.active!==false),percentage=active.filter(rule=>rule.ruleType==="PERCENTUAL"),totalBasisPoints=percentage.reduce((sum,rule)=>sum+(rule.percentageBasisPoints??0),0),integral=active.length>0&&active.length===percentage.length;
  return{totalBasisPoints,integral,valid:!integral||totalBasisPoints===10000,missingBasisPoints:Math.max(0,10000-totalBasisPoints),excessBasisPoints:Math.max(0,totalBasisPoints-10000)};
}

export type AllocationRule = {
  id?: number;
  recipientName?: string;
  recipient_name?: string;
  ruleType?: string;
  rule_type?: string;
  percentageBasisPoints?: number | null;
  percentage_basis_points?: number | null;
  fixedAmountCents?: number | null;
  fixed_amount_cents?: number | null;
  displayOrder?: number;
  display_order?: number;
  financialDestination?: AllocationFinancialDestination | string;
  financial_destination?: AllocationFinancialDestination | string;
  active?: boolean | number;
};

export type AllocationResult = {
  ruleId: number | null;
  recipientName: string;
  ruleType: "PERCENTUAL" | "FIXO" | "RESTANTE";
  financialDestination: AllocationFinancialDestination;
  calculatedAmountCents: number;
  displayOrder: number;
};

function allocationValue(rule: AllocationRule, camel: keyof AllocationRule, snake: keyof AllocationRule) {
  return rule[camel] ?? rule[snake];
}

export function allocationFinancialDestination(rule: AllocationRule): AllocationFinancialDestination {
  return allocationValue(rule, "financialDestination", "financial_destination") === "MANTER_NA_UNIDADE" ? "MANTER_NA_UNIDADE" : "REPASSAR";
}

export function validateAllocationRules(rules: AllocationRule[]) {
  const active = rules.filter((rule) => rule.active !== false && rule.active !== 0);
  let totalBasisPoints = 0;
  let remainderCount = 0;
  for (const rule of active) {
    const type = String(allocationValue(rule, "ruleType", "rule_type") || "");
    const percentage = Number(allocationValue(rule, "percentageBasisPoints", "percentage_basis_points") ?? 0);
    const fixed = Number(allocationValue(rule, "fixedAmountCents", "fixed_amount_cents") ?? 0);
    const destination = allocationValue(rule, "financialDestination", "financial_destination");
    if (!(["PERCENTUAL", "FIXO", "RESTANTE"] as string[]).includes(type)) return { valid: false, code: "TIPO_INVALIDO", totalBasisPoints, remainderCount };
    if (destination !== undefined && !(["REPASSAR", "MANTER_NA_UNIDADE"] as unknown[]).includes(destination)) return { valid: false, code: "DESTINACAO_INVALIDA", totalBasisPoints, remainderCount };
    if (type === "PERCENTUAL") {
      if (!Number.isInteger(percentage) || percentage < 0 || percentage > 10000) return { valid: false, code: "PERCENTUAL_INVALIDO", totalBasisPoints, remainderCount };
      totalBasisPoints += percentage;
    }
    if (type === "FIXO" && (!Number.isSafeInteger(fixed) || fixed <= 0)) return { valid: false, code: "VALOR_FIXO_INVALIDO", totalBasisPoints, remainderCount };
    if (type === "RESTANTE") remainderCount += 1;
  }
  if (!active.length) return { valid: false, code: "RATEIO_VAZIO", totalBasisPoints, remainderCount };
  if (remainderCount > 1) return { valid: false, code: "SALDO_RESTANTE_DUPLICADO", totalBasisPoints, remainderCount };
  if (totalBasisPoints > 10000) return { valid: false, code: "PERCENTUAL_EXCEDENTE", totalBasisPoints, remainderCount };
  return { valid: true, code: null, totalBasisPoints, remainderCount };
}

export function calculateAllocation(baseCents: number, rules: AllocationRule[]) {
  if (!Number.isSafeInteger(baseCents) || baseCents < 0) throw new Error("BASE_INVALIDA");
  const validation = validateAllocationRules(rules);
  if (!validation.valid) throw new Error(validation.code || "RATEIO_INVALIDO");
  const ordered = rules
    .filter((rule) => rule.active !== false && rule.active !== 0)
    .map((rule, index) => ({ rule, index, order: Number(allocationValue(rule, "displayOrder", "display_order") ?? index + 1) }))
    .sort((a, b) => a.order - b.order || a.index - b.index);
  const results: AllocationResult[] = ordered.map(({ rule, order }) => ({
    ruleId: rule.id ?? null,
    recipientName: String(allocationValue(rule, "recipientName", "recipient_name") || "Destinatário"),
    ruleType: String(allocationValue(rule, "ruleType", "rule_type")) as AllocationResult["ruleType"],
    financialDestination: allocationFinancialDestination(rule),
    calculatedAmountCents: 0,
    displayOrder: order,
  }));
  let allocated = 0;
  for (let index = 0; index < ordered.length; index += 1) {
    const type = results[index].ruleType;
    if (type === "FIXO") results[index].calculatedAmountCents = Number(allocationValue(ordered[index].rule, "fixedAmountCents", "fixed_amount_cents") ?? 0);
    if (type === "PERCENTUAL") {
      const basisPoints = Number(allocationValue(ordered[index].rule, "percentageBasisPoints", "percentage_basis_points") ?? 0);
      results[index].calculatedAmountCents = Math.floor((baseCents * basisPoints) / 10000);
    }
    allocated += results[index].calculatedAmountCents;
  }
  if (allocated > baseCents) return { valid: false, baseCents, allocatedCents: allocated, unallocatedCents: 0, excessCents: allocated - baseCents, results };
  const remainder = results.find((result) => result.ruleType === "RESTANTE");
  if (remainder) {
    remainder.calculatedAmountCents = baseCents - allocated;
    allocated = baseCents;
  } else if (validation.totalBasisPoints === 10000 && results.every((result) => result.ruleType === "PERCENTUAL")) {
    const residual = baseCents - allocated;
    if (residual > 0) results[results.length - 1].calculatedAmountCents += residual;
    allocated = baseCents;
  }
  return { valid: true, baseCents, allocatedCents: allocated, unallocatedCents: baseCents - allocated, excessCents: 0, results };
}

export function canReopenPeriod(actor:{scope:string;boundMatrixId:number|null;isPlatformOwner:boolean;platformTenantContextActive?:boolean},period:{matrixId:number}){
  if(actor.isPlatformOwner)return actor.platformTenantContextActive===true;
  return actor.scope==="MATRIZ"&&actor.boundMatrixId===period.matrixId;
}
