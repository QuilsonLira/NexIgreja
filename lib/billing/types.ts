export type BillingPeriod = "MENSAL" | "TRIMESTRAL" | "SEMESTRAL" | "ANUAL";
export type SubscriptionStatus = "TESTE" | "ATIVA" | "AGUARDANDO_PAGAMENTO" | "EM_CARENCIA" | "SUSPENSA" | "CANCELADA" | "ENCERRADA" | "ISENTA";
export type ChargeStatus = "PENDENTE" | "PAGA" | "VENCIDA" | "CANCELADA" | "ISENTA";
export type PaymentMethod = "PIX" | "TRANSFERENCIA" | "DINHEIRO" | "BOLETO" | "CARTAO" | "OUTRO";

export interface LicenseSummary {
  status: SubscriptionStatus;
  canAccess: boolean;
  canViewDetails: boolean;
  title: string;
  message: string;
  daysRemaining: number | null;
  nextDueDate: string | null;
  trialEndDate: string | null;
  graceEndDate: string | null;
  payment: BillingSettingsPublic;
}

export interface BillingSettingsPublic {
  warningDays: number; pixKey: string | null; pixKeyType: string | null; payeeName: string | null;
  bankName: string | null; bankAgency: string | null; bankAccount: string | null;
  instructions: string | null; supportContact: string | null;
}

export interface PlanRecord {
  id: number; name: string; description: string | null; priceCents: number; billingPeriod: BillingPeriod;
  defaultGraceDays: number; defaultTrialDays: number; status: "ATIVO" | "INATIVO"; createdAt: string; updatedAt: string;
}

export interface CommercialProfileRecord {
  tenantId: number; personType: "PESSOA_FISICA" | "PESSOA_JURIDICA"; legalName: string; document: string | null;
  responsibleName: string | null; phone: string | null; billingEmail: string | null; notes: string | null; customerSince: string;
}

export interface SubscriptionRecord {
  id: number; tenantId: number; tenantName: string; accessCode: string; planId: number | null; planName: string | null;
  contractedPriceCents: number; customPriceCents: number | null; effectivePriceCents: number; billingPeriod: BillingPeriod;
  status: SubscriptionStatus; startDate: string; nextDueDate: string | null; dueDay: number | null; graceDays: number;
  trialStartDate: string | null; trialEndDate: string | null; accessUntil: string | null; autoRenew: boolean;
  notes: string | null; suspendedReason: string | null; createdAt: string; updatedAt: string;
}

export interface ChargeRecord {
  id: number; tenantId: number; subscriptionId: number; competence: string; description: string; amountCents: number;
  issuedDate: string; dueDate: string; status: ChargeStatus; paidAt: string | null; paymentMethod: PaymentMethod | null;
  notes: string | null; createdAt: string; updatedAt: string;
}

export interface CommercialAuditRecord {
  id: number; action: string; entityType: string; entityId: number; previousValues: string | null;
  newValues: string | null; reason: string | null; actorName: string; createdAt: string;
}

export interface CommercialTenantDetail {
  profile: CommercialProfileRecord; subscription: SubscriptionRecord; charges: ChargeRecord[];
  history: CommercialAuditRecord[]; plans: PlanRecord[]; settings: BillingSettingsPublic;
}

export interface CommercialDashboard {
  counters: { active: number; trial: number; dueSoon: number; overdue: number; grace: number; suspended: number };
  subscriptions: SubscriptionRecord[];
}
