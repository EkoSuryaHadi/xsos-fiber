/**
 * Business API Client — Frontend bridge to nms-proxy via Next.js route handler /api/nms/business/*
 */
import type {
  TenantCustomer,
  BodRequestItem,
  InvoiceStatement,
  SlaTierType,
  CapacityType,
  SlaComplianceRecord,
} from "@/types/lifecycle";

export interface BusinessOverview {
  total_tenants: number;
  active_tenants: number;
  total_circuits: number;
  active_circuits: number;
  total_invoiced_amount: number;
  total_paid_amount: number;
  pending_bod_requests: number;
}

export interface CreateInvoicePayload {
  tenant_id: string;
  billing_period?: string;
  base_port_fee: number;
  bod_burst_usage_hours: number;
  bod_burst_rate_per_hour: number;
  bod_burst_total: number;
  sla_outage_downtime_min: number;
  sla_penalty_credit: number;
  status?: "Draft" | "Issued" | "Paid";
  due_date?: string;
}

export interface CreateBodPayload {
  tenant_id: string;
  route: string;
  source_panel: string;
  source_port: number;
  target_panel: string;
  target_port: number;
  capacity: CapacityType;
  sla_tier: SlaTierType;
  duration: "Recurring" | "Temporary Burst (24h)" | "Event (72h)";
  insertion_loss_db?: number;
  return_loss_db?: number;
  est_switching_time_sec?: number;
  monthly_cost?: number;
}

export async function fetchBusinessOverview(): Promise<BusinessOverview> {
  const res = await fetch("/api/nms/business/overview", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch business overview: ${res.statusText}`);
  return res.json();
}

export async function fetchTenants(): Promise<TenantCustomer[]> {
  const res = await fetch("/api/nms/business/tenants", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch tenants: ${res.statusText}`);
  const data = await res.json();
  return data.map((t: any) => ({
    id: t.id,
    name: t.name,
    asn: t.asn,
    customerType: t.customer_type,
    contactEmail: t.contact_email,
    rackLocation: t.rack_location,
    activeCircuitsCount: t.active_circuits_count ?? 0,
    contractTier: t.contract_tier,
    monthlyBaseCommit: t.monthly_base_commit,
    status: t.status,
  }));
}

export async function fetchInvoices(): Promise<InvoiceStatement[]> {
  const res = await fetch("/api/nms/business/invoices", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch invoices: ${res.statusText}`);
  const data = await res.json();
  return data.map((inv: any) => ({
    invoiceNo: inv.id,
    tenantId: inv.tenant_id,
    tenantName: inv.tenant_name ?? inv.tenant_id,
    asn: inv.asn ?? 0,
    billingPeriod: inv.billing_period,
    basePortFee: inv.base_port_fee,
    bodBurstUsageHours: inv.bod_burst_usage_hours,
    bodBurstRatePerHour: inv.bod_burst_rate_per_hour,
    bodBurstTotal: inv.bod_burst_total,
    slaOutageDowntimeMin: inv.sla_outage_downtime_min,
    slaPenaltyCredit: inv.sla_penalty_credit,
    subtotal: inv.subtotal,
    taxAmount: inv.tax_amount,
    totalDue: inv.total_due,
    status: inv.status,
    dueDate: inv.due_date,
  }));
}

export async function createInvoice(payload: CreateInvoicePayload): Promise<InvoiceStatement> {
  const res = await fetch("/api/nms/business/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create invoice: ${res.statusText}`);
  const inv = await res.json();
  return {
    invoiceNo: inv.id,
    tenantId: inv.tenant_id,
    tenantName: inv.tenant_name ?? inv.tenant_id,
    asn: inv.asn ?? 0,
    billingPeriod: inv.billing_period,
    basePortFee: inv.base_port_fee,
    bodBurstUsageHours: inv.bod_burst_usage_hours,
    bodBurstRatePerHour: inv.bod_burst_rate_per_hour,
    bodBurstTotal: inv.bod_burst_total,
    slaOutageDowntimeMin: inv.sla_outage_downtime_min,
    slaPenaltyCredit: inv.sla_penalty_credit,
    subtotal: inv.subtotal,
    taxAmount: inv.tax_amount,
    totalDue: inv.total_due,
    status: inv.status,
    dueDate: inv.due_date,
  };
}

export async function updateInvoiceStatus(invoiceId: string, status: "Paid" | "Issued" | "Draft"): Promise<void> {
  const res = await fetch(`/api/nms/business/invoices/${encodeURIComponent(invoiceId)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to update invoice status: ${res.statusText}`);
}

export async function generateAllInvoices(billingPeriod: string = "October 2026"): Promise<InvoiceStatement[]> {
  const res = await fetch(`/api/nms/business/billing/generate-all?billing_period=${encodeURIComponent(billingPeriod)}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to run automated rating engine: ${res.statusText}`);
  const data = await res.json();
  return data.map((inv: any) => ({
    invoiceNo: inv.id,
    tenantId: inv.tenant_id,
    tenantName: inv.tenant_name ?? inv.tenant_id,
    asn: inv.asn ?? 0,
    billingPeriod: inv.billing_period,
    basePortFee: inv.base_port_fee,
    bodBurstUsageHours: inv.bod_burst_usage_hours,
    bodBurstRatePerHour: inv.bod_burst_rate_per_hour,
    bodBurstTotal: inv.bod_burst_total,
    slaOutageDowntimeMin: inv.sla_outage_downtime_min,
    slaPenaltyCredit: inv.sla_penalty_credit,
    subtotal: inv.subtotal,
    taxAmount: inv.tax_amount,
    totalDue: inv.total_due,
    status: inv.status,
    dueDate: inv.due_date,
  }));
}

export async function previewTenantInvoice(tenantId: string, billingPeriod: string = "October 2026"): Promise<any> {
  const res = await fetch(`/api/nms/business/billing/preview/${encodeURIComponent(tenantId)}?billing_period=${encodeURIComponent(billingPeriod)}`, {
    method: "GET",
  });
  if (!res.ok) throw new Error(`Failed to preview tenant invoice: ${res.statusText}`);
  return res.json();
}

export async function fetchBodRequests(): Promise<BodRequestItem[]> {
  const res = await fetch("/api/nms/business/bod/requests", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch BoD requests: ${res.statusText}`);
  const data = await res.json();
  return data.map((b: any) => ({
    id: b.id,
    tenantId: b.tenant_id,
    tenantName: b.tenant_name ?? b.tenant_id,
    route: b.route,
    sourcePanel: b.source_panel,
    sourcePort: b.source_port,
    targetPanel: b.target_panel,
    targetPort: b.target_port,
    capacity: b.capacity,
    slaTier: b.sla_tier,
    duration: b.duration,
    stage: b.stage,
    submittedAt: new Date(b.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    insertionLossDb: b.insertion_loss_db,
    returnLossDb: b.return_loss_db,
    estSwitchingTimeSec: b.est_switching_time_sec,
    monthlyCost: b.monthly_cost,
    autoApproved: b.auto_approved,
  }));
}

export async function createBodRequest(payload: CreateBodPayload): Promise<BodRequestItem> {
  const res = await fetch("/api/nms/business/bod/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create BoD request: ${res.statusText}`);
  const b = await res.json();
  return {
    id: b.id,
    tenantId: b.tenant_id,
    tenantName: b.tenant_name ?? b.tenant_id,
    route: b.route,
    sourcePanel: b.source_panel,
    sourcePort: b.source_port,
    targetPanel: b.target_panel,
    targetPort: b.target_port,
    capacity: b.capacity,
    slaTier: b.sla_tier,
    duration: b.duration,
    stage: b.stage,
    submittedAt: new Date(b.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    insertionLossDb: b.insertion_loss_db,
    returnLossDb: b.return_loss_db,
    estSwitchingTimeSec: b.est_switching_time_sec,
    monthlyCost: b.monthly_cost,
    autoApproved: b.auto_approved,
  };
}

export async function updateBodStage(requestId: string, stage: number): Promise<void> {
  const res = await fetch(`/api/nms/business/bod/requests/${encodeURIComponent(requestId)}/stage`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stage }),
  });
  if (!res.ok) throw new Error(`Failed to update BoD stage: ${res.statusText}`);
}

export async function fetchSlaCompliance(): Promise<SlaComplianceRecord[]> {
  const res = await fetch("/api/nms/business/sla/compliance", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch SLA compliance: ${res.statusText}`);
  const data = await res.json();
  return data.map((d: any) => ({
    customerType: d.customer_type,
    slaTier: d.sla_tier,
    uptimeTargetPct: d.uptime_target_pct,
    actualUptimePct: d.actual_uptime_pct,
    latencyTargetMs: d.latency_target_ms,
    actualLatencyMs: d.actual_latency_ms,
    status: d.status,
  }));
}

export async function fetchOutageIncidents(): Promise<any[]> {
  const res = await fetch("/api/nms/business/sla/incidents", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch incidents: ${res.statusText}`);
  return res.json();
}

export async function simulateOutageIncident(payload: {
  circuit_id?: string;
  downtime_minutes: number;
  severity?: string;
  root_cause?: string;
}): Promise<any> {
  const res = await fetch("/api/nms/business/sla/incidents/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      circuit_id: payload.circuit_id || "CKT-1001",
      downtime_minutes: payload.downtime_minutes,
      severity: payload.severity || "Critical",
      root_cause: payload.root_cause || "Simulated Optical LOS Event",
    }),
  });
  if (!res.ok) throw new Error(`Failed to simulate incident: ${res.statusText}`);
  return res.json();
}

export async function resolveOutageIncident(incidentId: string): Promise<any> {
  const res = await fetch(`/api/nms/business/sla/incidents/${encodeURIComponent(incidentId)}/resolve`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to resolve incident: ${res.statusText}`);
  return res.json();
}

export async function fetchTelemetryStatus(): Promise<any> {
  const res = await fetch("/api/nms/business/telemetry/status", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch telemetry status: ${res.statusText}`);
  return res.json();
}

export interface FacilityFloor {
  id: string;
  name: string;
  room: string;
  total_fibers: number;
  xsos_units: string;
  role: string;
  status: "Nominal" | "Standby" | "Degraded" | string;
  description: string;
  active_circuits_count: number;
  interconnect?: string;
  racks: string[];
}

export async function fetchFacilityFloors(): Promise<FacilityFloor[]> {
  const res = await fetch("/api/nms/business/facility/floors", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch facility floors: ${res.statusText}`);
  return res.json();
}

