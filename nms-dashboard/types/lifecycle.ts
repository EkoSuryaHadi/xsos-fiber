// Tipe data kontrak domain untuk 5 Pilar Siklus Hidup IXP / DC Orchestration:
// 1. Provision Remote (BoD)
// 2. Monitor Current Connection
// 3. Availability SLA Engine
// 4. Multi-Layer Topology
// 5. CRM & Metered Billing

export type SlaTierType = "Platinum" | "Gold" | "Silver" | "Bronze";

export type CapacityType = "10G" | "100G" | "400G";

export interface TenantCustomer {
  id: string;
  name: string;
  asn: number;
  customerType: "Hyperscaler" | "CDN" | "FSI" | "Enterprise";
  contactEmail: string;
  rackLocation: string;
  activeCircuitsCount: number;
  contractTier: SlaTierType;
  monthlyBaseCommit: number;
  status: "Active" | "Suspended" | "Pending";
}

export interface BodRequestItem {
  id: string;
  tenantId: string;
  tenantName: string;
  route: string;
  sourcePanel: string;
  sourcePort: number;
  targetPanel: string;
  targetPort: number;
  capacity: CapacityType;
  slaTier: SlaTierType;
  duration: "Recurring" | "Temporary Burst (24h)" | "Event (72h)";
  stage: 0 | 1 | 2 | 3; // 0: Validating, 1: Configuring Hardware, 2: Activating, 3: Active
  submittedAt: string;
  insertionLossDb: number;
  returnLossDb: number;
  estSwitchingTimeSec: number;
  monthlyCost: number;
  autoApproved: boolean;
}

export interface SlaComplianceRecord {
  customerType: "Hyperscaler" | "CDN" | "FSI (Financial Services)" | "Enterprise";
  slaTier: SlaTierType;
  uptimeTargetPct: number;
  actualUptimePct: number;
  latencyTargetMs: number;
  actualLatencyMs: number;
  status: "Good" | "Watch" | "Breach";
}

export interface PredictiveWarning {
  id: string;
  unit: string;
  message: string;
  riskLevel: "Low" | "Medium" | "High";
  forecastWindowDays: number;
  category: "Optical" | "Thermal" | "Mechanical Actuator" | "Control Plane";
}

export interface MaintenanceTicketItem {
  id: string;
  category: "Optical LOS" | "NetConf Controller" | "Matrix Latency" | "Preventive Swap";
  title: string;
  source: string;
  location: string;
  status: "Scheduled" | "In Progress" | "Resolved" | "Open";
  severity: "Critical" | "Warning" | "Info";
  window: string;
}

export interface InvoiceStatement {
  invoiceNo: string;
  tenantId: string;
  tenantName: string;
  asn: number;
  billingPeriod: string;
  basePortFee: number;
  bodBurstUsageHours: number;
  bodBurstRatePerHour: number;
  bodBurstTotal: number;
  slaOutageDowntimeMin: number;
  slaPenaltyCredit: number; // Pemotongan kredit restitusi penalti
  subtotal: number;
  taxAmount: number;
  totalDue: number;
  status: "Draft" | "Issued" | "Paid";
  dueDate: string;
}
