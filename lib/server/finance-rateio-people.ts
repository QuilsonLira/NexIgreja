import { ApiError, database } from "@/lib/server/auth";
import { generatedId } from "@/lib/server/admin";
import type { AdministrativeSession } from "@/lib/types";
import { calculateAllocation, type AllocationRule } from "@/lib/finance/policy";

type Input=Record<string,unknown>;
type Row=Record<string,unknown>;
type RateioContext={session:AdministrativeSession;permissions:Set<string>};
type PersonAdjustment={ruleId?:number;displayOrder?:number;adjustmentCents:number;reason:string};

const now=()=>new Date().toISOString();
const clean=(value:unknown,max=500)=>typeof value==="string"?value.trim().replace(/[<>]/g,"").slice(0,max):"";
const positive=(value:unknown,label="Registro")=>{const n=Number(value);if(!Number.isInteger(n)||n<=0)throw new ApiError(400,"DADOS_INVALIDOS",`${label} inválido.`);return n;};
const optionalId=(value:unknown)=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
const cents=(value:unknown,label="Valor")=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw new ApiError(400,"VALOR_INVALIDO",`${label} inválido.`);return n;};
const signedCents=(value:unknown)=>{const n=Number(value||0);if(!Number.isSafeInteger(n))throw new ApiError(400,"AJUSTE_INVALIDO","O ajuste informado é inválido.");return n;};
const isoDate=(value:unknown)=>{const result=clean(value,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(result))throw new ApiError(400,"DATA_INVALIDA","Informe uma data válida.");return result;};

function nextMonthDue(competency:string,dueDay:number){
  const [year,month]=competency.split("-").map(Number),date=new Date(Date.UTC(year,month,1));
  const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}-${String(Math.min(Math.max(1,dueDay),last)).padStart(2,"0")}`;
}

async function advancesByRule(tenantId:number,periodId:number){
  const rows=await database().prepare("SELECT source_entity_id rule_id,COALESCE(SUM(amount_cents),0) amount_cents FROM finance_movements WHERE tenant_id=? AND period_id=? AND source_entity='RATEIO_ADIANTAMENTO' AND direction='SAIDA' AND status='CONFIRMADO' GROUP BY source_entity_id").bind(tenantId,periodId).all<{rule_id:number;amount_cents:number}>();
  return new Map(rows.results.map(row=>[Number(row.rule_id),Number(row.amount_cents||0)]));
}

export async function decoratePersonAllocationPreview(input:{tenantId:number;periodId:number;ruless:Row[];preview:Record<string,unknown>}){
  const advances=await advancesByRule(input.tenantId,input.periodId),rules=input.ruless,rawResults=Array.isArray(input.preview.results)?input.preview.results as Row[]:[];
  let personCents=0,transferCents=0,advanceCents=0;
  const results=rawResults.map((result,index)=>{
    const rule=rules.find(row=>Number(row.display_order)===Number(result.displayOrder||result.display_order||index+1))||rules[index],personId=Number(rule?.person_id||0)||null,gross=Number(result.calculatedAmountCents??result.calculated_amount_cents??0),ruleId=Number(rule?.id||result.ruleId||0)||null;
    if(!personId){if(String(result.financialDestination||result.financial_destination)==="REPASSAR")transferCents+=gross;return result;}
    const advanced=ruleId?Number(advances.get(ruleId)||0):0,remaining=Math.max(0,gross-advanced);personCents+=gross;advanceCents+=advanced;
    return{...result,ruleId,financialDestination:"PAGAR_PESSOA",personId,beneficiaryType:String(rule?.beneficiary_type||rule?.recipient_type||"OUTRO"),payableDescription:String(rule?.payable_description||rule?.description||rule?.recipient_name||"Pagamento"),dueDay:Number(rule?.due_day||10),advanceAmountCents:advanced,finalPayableCents:remaining};
  });
  return{...input.preview,results,calculatedToTransferCents:transferCents,pendingTransferCents:transferCents,calculatedToPersonCents:personCents,personAdvanceCents:advanceCents,personPayableCents:Math.max(0,personCents-advanceCents)};
}

export async function registerRateioPersonAdvance(ctx:RateioContext,input:Input){
  const periodId=positive(input.periodId,"Caixa"),ruleId=positive(input.ruleId,"Regra"),accountId=positive(input.accountId,"Conta"),amount=cents(input.amountCents,"Valor do adiantamento"),occurredOn=isoDate(input.occurredOn),paymentMethodId=optionalId(input.paymentMethodId);
  const period=await database().prepare("SELECT id,unit_id,competency,status,closure_version FROM finance_periods WHERE id=? AND tenant_id=?").bind(periodId,ctx.session.user.tenantId).first<{id:number;unit_id:number;competency:string;status:string;closure_version:number}>();
  if(!period||period.status!=="ABERTO")throw new ApiError(409,"CAIXA_FECHADO","O adiantamento só pode ser registrado antes de concluir o fechamento.");
  if(ctx.session.activeContext?.unitId!==period.unit_id)throw new ApiError(403,"FORA_DO_ESCOPO","Selecione a unidade deste caixa no topo antes de registrar o adiantamento.");
  if(occurredOn.slice(0,7)!==period.competency)throw new ApiError(400,"DATA_FORA_DA_COMPETENCIA","O adiantamento desta conferência deve ser lançado dentro da competência do caixa.");
  const rule=await database().prepare("SELECT id,person_id,recipient_name,payable_description FROM finance_period_allocation_rules WHERE id=? AND tenant_id=? AND period_id=?").bind(ruleId,ctx.session.user.tenantId,periodId).first<{id:number;person_id:number|null;recipient_name:string;payable_description:string|null}>();
  if(!rule?.person_id)throw new ApiError(400,"REGRA_PESSOA_INVALIDA","Esta divisão não está configurada para pagar uma pessoa.");
  const account=await database().prepare("SELECT id FROM finance_accounts WHERE id=? AND tenant_id=? AND unit_id=? AND status='ATIVA'").bind(accountId,ctx.session.user.tenantId,period.unit_id).first();if(!account)throw new ApiError(400,"CONTA_INVALIDA","Selecione uma conta ativa desta unidade.");
  if(paymentMethodId){const method=await database().prepare("SELECT id FROM finance_payment_methods WHERE id=? AND tenant_id=? AND status='ATIVO'").bind(paymentMethodId,ctx.session.user.tenantId).first();if(!method)throw new ApiError(400,"FORMA_PAGAMENTO_INVALIDA","Selecione uma forma de pagamento ativa.");}
  const movementId=generatedId(),stamp=now(),description=`Adiantamento — ${clean(rule.payable_description||rule.recipient_name,240)}`,key=`rateio-advance:${periodId}:${ruleId}:${movementId}`;
  await database().batch([
    database().prepare("INSERT INTO finance_movements(id,tenant_id,unit_id,account_id,direction,amount_cents,occurred_on,competency,description,payment_method_id,person_id,source,source_entity,source_entity_id,privacy,status,idempotency_key,created_by_user_id,created_at,updated_at,period_id,created_during_reopening) VALUES(?,?,?,?, 'SAIDA',?,?,?,?,?,?,'OUTRO','RATEIO_ADIANTAMENTO',?,'IDENTIFICADA_PRIVADA','CONFIRMADO',?,?,?,?,?,?)").bind(movementId,ctx.session.user.tenantId,period.unit_id,accountId,amount,occurredOn,period.competency,description,paymentMethodId,rule.person_id,rule.id,key,ctx.session.user.id,stamp,stamp,period.id,period.closure_version>0?1:0),
    database().prepare("INSERT INTO finance_audit(tenant_id,unit_id,actor_user_id,actor_membership_id,action,entity_type,entity_id,previous_values,new_values,reason,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(ctx.session.user.tenantId,period.unit_id,ctx.session.user.id,ctx.session.user.membershipId,"REGISTRAR_ADIANTAMENTO_RATEIO","MOVIMENTO",movementId,null,JSON.stringify({periodId,ruleId,personId:rule.person_id,amountCents:amount}),clean(input.notes,500)||null,stamp)
  ]);
  return{id:movementId,amountCents:amount,message:"Adiantamento registrado no caixa e considerado na conferência do rateio."};
}

export async function preparePersonRateioObligations(input:{tenantId:number;userId:number;periodId:number;sourceUnitId:number;competency:string;closureVersion:number;stamp:string;rules:Row[];results:Row[];adjustments?:unknown}){
  const personRules=input.rules.filter(rule=>Number(rule.person_id||0)>0),advances=await advancesByRule(input.tenantId,input.periodId),adjustmentRows=Array.isArray(input.adjustments)?input.adjustments as Input[]:[],adjustments=new Map<number,PersonAdjustment>();
  for(const raw of adjustmentRows){const order=Number(raw.displayOrder||0),amount=signedCents(raw.adjustmentCents),reason=clean(raw.reason,500);if(!Number.isInteger(order)||order<=0)continue;if(amount!==0&&reason.length<5)throw new ApiError(400,"MOTIVO_AJUSTE_OBRIGATORIO",`Explique o ajuste da divisão ${order}.`);adjustments.set(order,{displayOrder:order,adjustmentCents:amount,reason});}
  const statements:any[]=[],generated:Array<{id:number;personId:number;amountCents:number;grossCents:number;advanceCents:number;adjustmentCents:number}>=[];
  for(const rule of personRules){
    const order=Number(rule.display_order),result=input.results.find(row=>Number(row.displayOrder||row.display_order)===order),gross=Number(result?.calculatedAmountCents??result?.calculated_amount_cents??0),advanced=Number(advances.get(Number(rule.id))||0),adjustment=adjustments.get(order)?.adjustmentCents||0,finalAmount=gross-advanced+adjustment;
    if(finalAmount<0)throw new ApiError(409,"ADIANTAMENTO_SUPERIOR_AO_DIREITO",`Os adiantamentos/ajustes de ${String(rule.recipient_name)} ultrapassam o valor calculado no rateio.`);
    const person=await database().prepare("SELECT id,full_name,cpf FROM people WHERE id=? AND tenant_id=?").bind(Number(rule.person_id),input.tenantId).first<{id:number;full_name:string;cpf:string|null}>();if(!person)throw new ApiError(409,"BENEFICIARIO_NAO_ENCONTRADO",`A pessoa vinculada à divisão ${order} não está disponível.`);
    const paid=await database().prepare("SELECT COALESCE(SUM(i.settled_amount_cents),0) paid_cents FROM finance_obligations o JOIN finance_installments i ON i.obligation_id=o.id AND i.tenant_id=o.tenant_id WHERE o.tenant_id=? AND o.rateio_period_id=? AND o.rateio_rule_order=? AND o.generated_by_rateio=1 AND i.status='PAGA' AND i.movement_id IS NOT NULL").bind(input.tenantId,input.periodId,order).first<{paid_cents:number}>(),alreadyPaid=Number(paid?.paid_cents||0);
    if(alreadyPaid>finalAmount)throw new ApiError(409,"RATEIO_JA_PAGO_EXIGE_ESTORNO",`${person.full_name} já recebeu valor superior ao novo cálculo. Estorne o pagamento antes de concluir este fechamento.`);
    const amountToGenerate=finalAmount-alreadyPaid;if(amountToGenerate===0)continue;
    const existing=await database().prepare("SELECT id FROM finance_obligations WHERE tenant_id=? AND rateio_period_id=? AND rateio_closure_version=? AND rateio_rule_order=? LIMIT 1").bind(input.tenantId,input.periodId,input.closureVersion,order).first<{id:number}>();if(existing)continue;
    const obligationId=generatedId(),installmentId=generatedId(),baseDescription=clean(rule.payable_description||rule.description||rule.recipient_name,220)||"Pagamento de rateio",description=`${baseDescription} — competência ${input.competency.slice(5,7)}/${input.competency.slice(0,4)}`,dueOn=nextMonthDue(input.competency,Number(rule.due_day||10)),adjustmentReason=adjustments.get(order)?.reason||null,notes=`Gerada automaticamente pelo rateio · fechamento v${input.closureVersion}${alreadyPaid?` · complemento após pagamento anterior de R$ ${(alreadyPaid/100).toFixed(2).replace('.',',')}`:""}`;
    statements.push(database().prepare("INSERT INTO finance_obligations(id,tenant_id,unit_id,kind,description,beneficiary_name,person_id,total_cents,competency,status,notes,version,created_by_user_id,created_at,updated_at,generated_by_rateio,rateio_period_id,rateio_closure_version,rateio_rule_id,rateio_rule_order,beneficiary_cpf_snapshot,rateio_gross_cents,rateio_advance_cents,rateio_adjustment_cents,rateio_adjustment_reason) VALUES(?,?,?,'PAGAR',?,?,?,?,?,'ABERTA',?,1,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(obligationId,input.tenantId,input.sourceUnitId,description,person.full_name,person.id,amountToGenerate,input.competency,notes,input.userId,input.stamp,input.stamp,1,input.periodId,input.closureVersion,Number(rule.id),order,person.cpf||null,gross,advanced,adjustment,adjustmentReason));
    statements.push(database().prepare("INSERT INTO finance_installments(id,tenant_id,obligation_id,installment_number,installment_count,due_on,amount_cents,status,created_at,updated_at) VALUES(?,?,?,1,1,?,?,'ABERTA',?,?)").bind(installmentId,input.tenantId,obligationId,dueOn,amountToGenerate,input.stamp,input.stamp));
    generated.push({id:obligationId,personId:person.id,amountCents:amountToGenerate,grossCents:gross,advanceCents:advanced,adjustmentCents:adjustment});
  }
  return{statements,generated};
}

export async function prepareRateioPersonReopenCancellation(input:{tenantId:number;periodId:number;closureVersion:number;reason:string;stamp:string}){
  const rows=await database().prepare("SELECT o.id,o.status,COUNT(CASE WHEN i.movement_id IS NOT NULL THEN 1 END) paid_count FROM finance_obligations o LEFT JOIN finance_installments i ON i.obligation_id=o.id AND i.tenant_id=o.tenant_id WHERE o.tenant_id=? AND o.rateio_period_id=? AND o.rateio_closure_version=? AND o.generated_by_rateio=1 GROUP BY o.id,o.status").bind(input.tenantId,input.periodId,input.closureVersion).all<{id:number;status:string;paid_count:number}>(),statements:any[]=[],cancelled:number[]=[],protectedIds:number[]=[];
  for(const row of rows.results){if(Number(row.paid_count||0)>0){protectedIds.push(row.id);continue;}if(row.status==="CANCELADA")continue;statements.push(database().prepare("UPDATE finance_installments SET status='CANCELADA',version=version+1,updated_at=? WHERE tenant_id=? AND obligation_id=? AND status='ABERTA'").bind(input.stamp,input.tenantId,row.id),database().prepare("UPDATE finance_obligations SET status='CANCELADA',rateio_cancel_reason=?,version=version+1,updated_at=? WHERE id=? AND tenant_id=?").bind(input.reason,input.stamp,row.id,input.tenantId));cancelled.push(row.id);}
  return{statements,cancelled,protectedIds};
}

export function personRuleStoredDestination(rule:Input){return Number(rule.personId||rule.person_id||0)>0?"REPASSAR":String(rule.financialDestination||rule.financial_destination||"REPASSAR");}

export function calculateRuleGross(baseCents:number,rules:AllocationRule[],displayOrder:number){const calculation=calculateAllocation(baseCents,rules);return Number(calculation.results.find(row=>row.displayOrder===displayOrder)?.calculatedAmountCents||0);}
