import type { BillingPeriod, LicenseSummary, SubscriptionStatus } from "./types.ts";

const DAY = 86_400_000;
export function isDateOnly(value: unknown): value is string { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)); }
export function dateNumber(value: string): number { const [y,m,d] = value.split("-").map(Number); return Date.UTC(y,m-1,d)/DAY; }
export function daysBetween(from: string, to: string): number { return dateNumber(to)-dateNumber(from); }
export function addDays(value: string, days: number): string { const date=new Date((dateNumber(value)+days)*DAY); return date.toISOString().slice(0,10); }
export function todayInBrazil(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Belem", year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(now);
  const get=(type:string)=>parts.find((part)=>part.type===type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function periodMonths(period: BillingPeriod): number { return { MENSAL:1, TRIMESTRAL:3, SEMESTRAL:6, ANUAL:12 }[period]; }
export function nextDueDate(reference: string, period: BillingPeriod, dueDay: number): string {
  const [year,month] = reference.split("-").map(Number); const date = new Date(Date.UTC(year, month-1+periodMonths(period), 1));
  const last = new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}-${String(Math.min(dueDay,last)).padStart(2,"0")}`;
}
export function paymentRenewal(paidDate: string, period: BillingPeriod, dueDay: number): { status: "ATIVA"; nextDueDate: string } {
  return { status: "ATIVA", nextDueDate: nextDueDate(paidDate, period, dueDay) };
}
export function canBypassLicense(isPlatformOwner: boolean): boolean { return isPlatformOwner; }
export type LicenseInput = { status: SubscriptionStatus; today: string; nextDueDate: string|null; graceDays:number; trialEndDate:string|null; accessUntil:string|null; warningDays:number };
export function evaluateLicense(input: LicenseInput): Omit<LicenseSummary,"canViewDetails"|"payment"> & { nextStatus: SubscriptionStatus } {
  const base={nextDueDate:input.nextDueDate,trialEndDate:input.trialEndDate,graceEndDate:null as string|null,daysRemaining:null as number|null};
  if (input.status === "ISENTA") {
    const left=input.accessUntil?daysBetween(input.today,input.accessUntil):null;
    if (left!==null&&left<0) return {...base,status:"ENCERRADA",nextStatus:"ENCERRADA",canAccess:false,title:"Cortesia encerrada",message:"O período de acesso cortesia terminou."};
    return {...base,status:"ISENTA",nextStatus:"ISENTA",canAccess:true,daysRemaining:left,title:"Licença cortesia",message:input.accessUntil?`Acesso liberado até ${input.accessUntil}.`:"Acesso liberado como cortesia."};
  }
  if (input.status === "CANCELADA" || input.status === "ENCERRADA" || input.status === "SUSPENSA") return {...base,status:input.status,nextStatus:input.status,canAccess:false,title:"Acesso temporariamente suspenso",message:"A assinatura do NexIgreja precisa ser regularizada."};
  if (input.status === "TESTE") {
    const left=input.trialEndDate?daysBetween(input.today,input.trialEndDate):-1;
    if (left>=0) return {...base,status:"TESTE",nextStatus:"TESTE",canAccess:true,daysRemaining:left,title:"Período de teste",message:left===0?"Seu período de teste termina hoje.":`Restam ${left} dias de teste.`};
    return {...base,status:"SUSPENSA",nextStatus:"SUSPENSA",canAccess:false,title:"Período de teste encerrado",message:"Escolha uma assinatura para continuar usando o NexIgreja."};
  }
  if (input.accessUntil && daysBetween(input.today,input.accessUntil)>=0) return {...base,status:input.status,nextStatus:input.status,canAccess:true,daysRemaining:daysBetween(input.today,input.accessUntil),title:"Acesso liberado",message:`Acesso disponível até ${input.accessUntil}.`};
  if (!input.nextDueDate) return {...base,status:"AGUARDANDO_PAGAMENTO",nextStatus:"AGUARDANDO_PAGAMENTO",canAccess:false,title:"Assinatura aguardando pagamento",message:"Registre o pagamento para liberar o acesso."};
  const untilDue=daysBetween(input.today,input.nextDueDate);
  if (untilDue>=0) return {...base,status:"ATIVA",nextStatus:"ATIVA",canAccess:true,daysRemaining:untilDue,title:"Assinatura ativa",message:untilDue===0?"Sua assinatura vence hoje.":untilDue<=input.warningDays?`Sua assinatura vence em ${untilDue} dias.`:`Próximo vencimento: ${input.nextDueDate}.`};
  const graceEnd=addDays(input.nextDueDate,input.graceDays); const graceLeft=daysBetween(input.today,graceEnd);
  if (graceLeft>=0) return {...base,graceEndDate:graceEnd,status:"EM_CARENCIA",nextStatus:"EM_CARENCIA",canAccess:true,daysRemaining:graceLeft,title:"Pagamento pendente",message:graceLeft===0?"O período de carência termina hoje.":`Restam ${graceLeft} dias de carência.`};
  return {...base,graceEndDate:graceEnd,status:"SUSPENSA",nextStatus:"SUSPENSA",canAccess:false,title:"Acesso temporariamente suspenso",message:"O período de carência terminou. Registre o pagamento para reativar o acesso."};
}
export function isPaymentIdempotent(chargeStatus:string, hasPayment:boolean): boolean { return chargeStatus === "PAGA" || hasPayment; }
