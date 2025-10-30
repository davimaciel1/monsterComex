import type { BillingCycle } from "./pricing";

export interface UserSummary {
  id: number;
  name: string;
  email: string;
}

export interface PlanSummary {
  id: number;
  importerQuota: number;
  exporterQuota: number;
  ncmQuota: number;
  billingCycle: BillingCycle;
  monthlyPrice: number;
  annualPrice: number;
  status: string;
}

export interface PlanUsage {
  importerUsed: number;
  exporterUsed: number;
  ncmUsed: number;
}

export interface SessionResponse {
  user: UserSummary;
  plan: PlanSummary | null;
  usage: PlanUsage;
}
