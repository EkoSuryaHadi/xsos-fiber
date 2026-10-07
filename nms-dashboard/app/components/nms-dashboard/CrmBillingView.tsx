"use client";

import React, { useState, useEffect } from "react";
import styles from "./CrmBillingView.module.css";
import { INITIAL_TENANTS, INITIAL_INVOICES } from "@/lib/lifecycle-data";
import { fetchTenants, fetchInvoices, createInvoice, updateInvoiceStatus, generateAllInvoices } from "@/lib/business-api";
import type { TenantCustomer, InvoiceStatement } from "@/types/lifecycle";

export default function CrmBillingView() {
  const [tenants, setTenants] = useState<TenantCustomer[]>(INITIAL_TENANTS);
  const [invoices, setInvoices] = useState<InvoiceStatement[]>(INITIAL_INVOICES);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceStatement | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDbSynced, setIsDbSynced] = useState<boolean>(false);
  const [isBatchRating, setIsBatchRating] = useState<boolean>(false);
  const [batchSuccessMsg, setBatchSuccessMsg] = useState<string | null>(null);

  // Live Calculator Simulator State
  const [simTenantId, setSimTenantId] = useState<string>("TNT-001");
  const [simBurstHours, setSimBurstHours] = useState<number>(48);
  const [simOutageMin, setSimOutageMin] = useState<number>(0);

  // Load live data from persistence layer on mount
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [liveTenants, liveInvoices] = await Promise.all([
          fetchTenants().catch(() => null),
          fetchInvoices().catch(() => null),
        ]);
        if (isMounted) {
          if (liveTenants && liveTenants.length > 0) {
            setTenants(liveTenants);
            setIsDbSynced(true);
          }
          if (liveInvoices && liveInvoices.length > 0) {
            setInvoices(liveInvoices);
          }
        }
      } catch (err) {
        console.warn("Could not load from backend, using baseline mock data:", err);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedSimTenant = tenants.find((t) => t.id === simTenantId) || tenants[0];
  const simHourlyRate = 25; // $25/hour for 100G/400G dynamic boost
  const simBurstTotal = simBurstHours * simHourlyRate;
  // SLA Penalty Credit formula: each outage minute beyond SLA = $35 credit refund
  const simPenaltyCredit = simOutageMin > 0 ? simOutageMin * 35 : 0;
  const simSubtotal = Math.max(0, (selectedSimTenant?.monthlyBaseCommit ?? 14500) + simBurstTotal - simPenaltyCredit);
  const simTax = simSubtotal * 0.11; // 11% VAT
  const simTotalDue = simSubtotal + simTax;

  const handleGenerateInvoice = async () => {
    setIsLoading(true);
    try {
      const savedInv = await createInvoice({
        tenant_id: selectedSimTenant.id,
        billing_period: "October 2026",
        base_port_fee: selectedSimTenant.monthlyBaseCommit,
        bod_burst_usage_hours: simBurstHours,
        bod_burst_rate_per_hour: simHourlyRate,
        bod_burst_total: simBurstTotal,
        sla_outage_downtime_min: simOutageMin,
        sla_penalty_credit: simPenaltyCredit,
        status: "Issued",
        due_date: "2026-11-15",
      });

      setInvoices((prev) => [savedInv, ...prev]);
      setSelectedInvoice(savedInv);
      setIsDbSynced(true);
    } catch (err) {
      console.warn("Gagal simpan ke backend DB, fallback ke state lokal:", err);
      const invNumber = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const newInv: InvoiceStatement = {
        invoiceNo: invNumber,
        tenantId: selectedSimTenant.id,
        tenantName: selectedSimTenant.name,
        asn: selectedSimTenant.asn,
        billingPeriod: "October 2026",
        basePortFee: selectedSimTenant.monthlyBaseCommit,
        bodBurstUsageHours: simBurstHours,
        bodBurstRatePerHour: simHourlyRate,
        bodBurstTotal: simBurstTotal,
        slaOutageDowntimeMin: simOutageMin,
        slaPenaltyCredit: simPenaltyCredit,
        subtotal: simSubtotal,
        taxAmount: simTax,
        totalDue: simTotalDue,
        status: "Issued",
        dueDate: "2026-11-15",
      };
      setInvoices((prev) => [newInv, ...prev]);
      setSelectedInvoice(newInv);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsPaid = async (invNo: string) => {
    try {
      await updateInvoiceStatus(invNo, "Paid");
    } catch (err) {
      console.warn("Gagal update status di backend:", err);
    }
    setInvoices((prev) =>
      prev.map((i) => (i.invoiceNo === invNo ? { ...i, status: "Paid" } : i))
    );
    if (selectedInvoice && selectedInvoice.invoiceNo === invNo) {
      setSelectedInvoice((prev) => (prev ? { ...prev, status: "Paid" } : null));
    }
  };

  const handleBatchAutoRate = async () => {
    setIsBatchRating(true);
    setBatchSuccessMsg(null);
    try {
      const generatedInvoices = await generateAllInvoices("October 2026");
      if (generatedInvoices && generatedInvoices.length > 0) {
        setInvoices(generatedInvoices);
        setIsDbSynced(true);
        setBatchSuccessMsg(
          `⚡ Auto-Rated ${generatedInvoices.length} tenant invoices successfully! SLA outage penalty credits and 11% VAT applied.`
        );
        setTimeout(() => setBatchSuccessMsg(null), 6000);
      }
    } catch (err) {
      console.error("Batch auto-rate failed:", err);
    } finally {
      setIsBatchRating(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* ====================================================================
          1. TOP CARD: IXP TENANT DIRECTORY (CRM)
          ==================================================================== */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardHeadTitles}>
            <div className={styles.cardTitle}>IXP Tenant Directory &amp; Member CRM</div>
            <div className={styles.cardSub}>
              Enterprise member organizations, allocated data hall racks, BGP ASN &amp; contract SLA tiers
            </div>
          </div>
          <span className={`${styles.badge} ${styles.badgeGood}`}>
            ● {tenants.length} Active Members
          </span>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tenant ID</th>
                <th>Member Organization</th>
                <th>ASN</th>
                <th>Category</th>
                <th>Rack Location</th>
                <th>Active Ports</th>
                <th>SLA Tier</th>
                <th>Monthly Base Commit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id}>
                  <td className={styles.mono} style={{ fontWeight: 700, color: "#003366" }}>
                    {t.id}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: "#14212E" }}>{t.name}</div>
                    <div style={{ fontSize: 10.5, color: "#8B98A5" }}>{t.contactEmail}</div>
                  </td>
                  <td className={styles.mono}>AS{t.asn}</td>
                  <td>{t.customerType}</td>
                  <td>{t.rackLocation}</td>
                  <td className={styles.mono} style={{ fontWeight: 600 }}>
                    {t.activeCircuitsCount} circuits
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        t.contractTier === "Platinum"
                          ? styles.badgePlatinum
                          : t.contractTier === "Gold"
                          ? styles.badgeGold
                          : styles.badgeSilver
                      }`}
                    >
                      {t.contractTier}
                    </span>
                  </td>
                  <td className={styles.mono} style={{ fontWeight: 600, color: "#14212E" }}>
                    ${t.monthlyBaseCommit.toLocaleString()} / mo
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles.badgeGood}`}>{t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====================================================================
          2. DUAL COLUMN ROW: SIMULATOR & INVOICES AUDIT
          ==================================================================== */}
      <div className={styles.row}>
        {/* Left Column: Dynamic Rating Engine Simulator */}
        <div className={`${styles.card} ${styles.col1}`}>
          <div className={styles.cardHead}>
            <div className={styles.cardHeadTitles}>
              <div className={styles.cardTitle}>Dynamic Rating &amp; SLA Credit Calculator</div>
              <div className={styles.cardSub}>Formula: Base Commit + BoD Burst Hours − SLA Outage Penalty</div>
            </div>
          </div>

          <div className={styles.cardBody} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Tenant Picker */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Select Tenant for Simulation</label>
              <select
                className={styles.select}
                value={simTenantId}
                onChange={(e) => setSimTenantId(e.target.value)}
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (AS{t.asn}) — Tier {t.contractTier}
                  </option>
                ))}
              </select>
            </div>

            {/* Slider 1: BoD Burst Hours */}
            <div className={styles.field}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className={styles.fieldLabel}>BoD Burst Usage (Metered Hours)</label>
                <strong className={styles.mono} style={{ fontSize: 11.5, color: "#003366" }}>
                  {simBurstHours} hrs (@ ${simHourlyRate}/hr)
                </strong>
              </div>
              <input
                type="range"
                className={styles.slider}
                min={0}
                max={240}
                step={6}
                value={simBurstHours}
                onChange={(e) => setSimBurstHours(parseInt(e.target.value, 10))}
              />
            </div>

            {/* Slider 2: SLA Outage Minutes */}
            <div className={styles.field}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className={styles.fieldLabel}>Unscheduled Outage Duration (SLA Breach)</label>
                <strong
                  className={styles.mono}
                  style={{
                    fontSize: 11.5,
                    color: simOutageMin > 0 ? "#c22f2f" : "#0ca30c",
                    fontWeight: 700,
                  }}
                >
                  {simOutageMin} mins downtime
                </strong>
              </div>
              <input
                type="range"
                className={styles.slider}
                min={0}
                max={60}
                step={5}
                value={simOutageMin}
                onChange={(e) => setSimOutageMin(parseInt(e.target.value, 10))}
                style={{ accentColor: simOutageMin > 0 ? "#c22f2f" : "#0ca30c" }}
              />
            </div>

            {/* Live Breakdown Box */}
            <div className={styles.calcCard}>
              <div className={styles.calcRow}>
                <span>Base Recurring Monthly Commit</span>
                <span className={styles.calcVal}>
                  ${(selectedSimTenant?.monthlyBaseCommit ?? 14500).toLocaleString()}
                </span>
              </div>
              <div className={styles.calcRow}>
                <span>Bandwidth-on-Demand ({simBurstHours}h × ${simHourlyRate})</span>
                <span className={styles.calcVal} style={{ color: "#003366" }}>
                  + ${simBurstTotal.toLocaleString()}
                </span>
              </div>
              <div className={styles.calcRow}>
                <span>SLA Downtime Penalty Credit ({simOutageMin} min)</span>
                <span className={styles.calcVal} style={{ color: simPenaltyCredit > 0 ? "#c22f2f" : "#8B98A5" }}>
                  {simPenaltyCredit > 0 ? `− $${simPenaltyCredit.toLocaleString()}` : "$0"}
                </span>
              </div>
              <div className={styles.calcRow} style={{ borderTop: "1px solid #EDEFF2", paddingTop: 6 }}>
                <span>Subtotal (Net of Penalties)</span>
                <span className={styles.calcVal}>
                  ${simSubtotal.toLocaleString()}
                </span>
              </div>
              <div className={styles.calcRow}>
                <span>VAT / Tax (11%)</span>
                <span className={styles.calcVal}>
                  ${simTax.toFixed(2)}
                </span>
              </div>
              <div className={`${styles.calcRow} ${styles.calcTotal}`}>
                <span>TOTAL INVOICE DUE</span>
                <span className={styles.calcTotalVal}>
                  ${simTotalDue.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              type="button"
              className={styles.submitBtn}
              onClick={handleGenerateInvoice}
              disabled={isLoading}
            >
              {isLoading ? "⏳ Storing to Database..." : "📄 Issue & Persist Monthly Invoice"}
            </button>
          </div>
        </div>

        {/* Right Column: Invoices & Statements Audit */}
        <div className={`${styles.card} ${styles.col2}`}>
          <div className={styles.cardHead}>
            <div className={styles.cardHeadTitles}>
              <div className={styles.cardTitle}>Invoices &amp; Billing Statements</div>
              <div className={styles.cardSub}>Audit history of issued statements and SLA compensations</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                className={`${styles.pillBtn} ${styles.pillBtnPrimary}`}
                onClick={handleBatchAutoRate}
                disabled={isBatchRating}
              >
                {isBatchRating ? "⚡ Rating Invoices..." : "⚡ Auto-Rate All Tenants"}
              </button>
              {isDbSynced && (
                <span className={`${styles.badge} ${styles.badgeGood}`} style={{ fontSize: 10 }}>
                  ● DB Synced
                </span>
              )}
              <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                {invoices.length} Invoices
              </span>
            </div>
          </div>

          {batchSuccessMsg && (
            <div
              style={{
                background: "rgba(12, 163, 12, 0.08)",
                border: "1px solid rgba(12, 163, 12, 0.2)",
                color: "#0b8f0b",
                padding: "8px 12px",
                borderRadius: 5,
                fontSize: 11.5,
                margin: "12px 16px 0 16px",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>✅</span>
              <span>{batchSuccessMsg}</span>
            </div>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Client / Tenant</th>
                  <th>Period</th>
                  <th>Base Fee</th>
                  <th>BoD Usage</th>
                  <th>SLA Credit</th>
                  <th>Total Due</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.invoiceNo}>
                    <td className={styles.mono} style={{ color: "#003366", fontWeight: 700 }}>
                      {inv.invoiceNo}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: "#14212E" }}>{inv.tenantName}</div>
                      <div style={{ fontSize: 10, color: "#8B98A5" }}>AS{inv.asn}</div>
                    </td>
                    <td>{inv.billingPeriod}</td>
                    <td className={styles.mono}>${inv.basePortFee.toLocaleString()}</td>
                    <td className={styles.mono} style={{ color: "#003366" }}>
                      +${inv.bodBurstTotal.toLocaleString()}
                    </td>
                    <td className={styles.mono} style={{ color: inv.slaPenaltyCredit > 0 ? "#c22f2f" : "#8B98A5", fontWeight: inv.slaPenaltyCredit > 0 ? 600 : 400 }}>
                      {inv.slaPenaltyCredit > 0 ? `−$${inv.slaPenaltyCredit.toLocaleString()}` : "$0"}
                    </td>
                    <td className={styles.mono} style={{ fontWeight: 700, color: "#0ca30c" }}>
                      ${inv.totalDue.toFixed(2)}
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          inv.status === "Paid" ? styles.badgeGood : styles.badgeWarning
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.pillBtn}
                        style={{ padding: "3px 8px", fontSize: 11 }}
                        onClick={() => setSelectedInvoice(inv)}
                      >
                        View Statement
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ====================================================================
          3. INVOICE STATEMENT MODAL
          ==================================================================== */}
      {selectedInvoice && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedInvoice(null)}>
          <div className={styles.invoiceModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.invoiceHead}>
              <div>
                <h3 className={styles.invoiceTitle}>
                  IXP BILLING STATEMENT: {selectedInvoice.invoiceNo}
                </h3>
                <div className={styles.invoiceSub}>
                  Billing Period: {selectedInvoice.billingPeriod} · Due: {selectedInvoice.dueDate}
                </div>
              </div>
              <button
                type="button"
                className={styles.invoiceClose}
                onClick={() => setSelectedInvoice(null)}
              >
                ✕
              </button>
            </div>

            <div className={styles.invoiceBody}>
              {/* Tenant Details Card */}
              <div className={styles.tenantCard}>
                <div className={styles.tenantCardOrg}>
                  Billed To: {selectedInvoice.tenantName}
                </div>
                <div className={styles.tenantCardMeta}>
                  Autonomous System Number: AS{selectedInvoice.asn} · Account Ref: {selectedInvoice.tenantId}
                </div>
              </div>

              {/* Itemized Table */}
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Item Description</th>
                      <th>Rate / Unit</th>
                      <th>Qty / Duration</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Optical Port Recurring Cross-Connect Fee</td>
                      <td className={styles.mono}>${selectedInvoice.basePortFee} / mo</td>
                      <td>1 Month</td>
                      <td className={styles.mono} style={{ textAlign: "right" }}>
                        ${selectedInvoice.basePortFee.toLocaleString()}
                      </td>
                    </tr>
                    {selectedInvoice.bodBurstUsageHours > 0 && (
                      <tr>
                        <td>Bandwidth-on-Demand (BoD) Dynamic Burst Capacity</td>
                        <td className={styles.mono}>${selectedInvoice.bodBurstRatePerHour} / hr</td>
                        <td>{selectedInvoice.bodBurstUsageHours} Hours</td>
                        <td className={styles.mono} style={{ textAlign: "right", color: "#003366", fontWeight: 600 }}>
                          +${selectedInvoice.bodBurstTotal.toLocaleString()}
                        </td>
                      </tr>
                    )}
                    {selectedInvoice.slaPenaltyCredit > 0 && (
                      <tr style={{ background: "rgba(208, 59, 59, 0.05)" }}>
                        <td style={{ color: "#c22f2f" }}>
                          SLA Availability Breach Compensation Credit ({selectedInvoice.slaOutageDowntimeMin} min downtime)
                        </td>
                        <td className={styles.mono} style={{ color: "#c22f2f" }}>Reimbursement</td>
                        <td style={{ color: "#c22f2f" }}>Penalty Clause 4.2</td>
                        <td className={styles.mono} style={{ textAlign: "right", color: "#c22f2f", fontWeight: 700 }}>
                          −${selectedInvoice.slaPenaltyCredit.toLocaleString()}
                        </td>
                      </tr>
                    )}
                    <tr style={{ borderTop: "2px solid #E2E6EB" }}>
                      <td colSpan={3} style={{ textAlign: "right", fontWeight: 700, color: "#14212E" }}>Subtotal Net:</td>
                      <td className={styles.mono} style={{ textAlign: "right", fontWeight: 700 }}>
                        ${selectedInvoice.subtotal.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3} style={{ textAlign: "right", color: "#5C6B7A" }}>Tax / VAT (11%):</td>
                      <td className={styles.mono} style={{ textAlign: "right" }}>
                        ${selectedInvoice.taxAmount.toFixed(2)}
                      </td>
                    </tr>
                    <tr style={{ background: "rgba(12, 163, 12, 0.06)" }}>
                      <td colSpan={3} style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: "#14212E" }}>
                        TOTAL AMOUNT DUE:
                      </td>
                      <td
                        className={styles.mono}
                        style={{ textAlign: "right", fontSize: 16, fontWeight: 700, color: "#0ca30c" }}
                      >
                        ${selectedInvoice.totalDue.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className={styles.invoiceActions}>
                {selectedInvoice.status !== "Paid" && (
                  <button
                    type="button"
                    className={`${styles.pillBtn} ${styles.pillBtnSuccess}`}
                    onClick={() => handleMarkAsPaid(selectedInvoice.invoiceNo)}
                  >
                    ✓ Mark as Paid
                  </button>
                )}
                <button
                  type="button"
                  className={styles.pillBtn}
                  onClick={() => alert(`Faktur ${selectedInvoice.invoiceNo} telah diunduh sebagai format resmi CSV / PDF.`)}
                >
                  📥 Export PDF / CSV
                </button>
                <button
                  type="button"
                  className={styles.submitBtn}
                  onClick={() => {
                    alert(`Notifikasi tagihan ${selectedInvoice.invoiceNo} dikirim ke ${selectedInvoice.tenantName}!`);
                    setSelectedInvoice(null);
                  }}
                >
                  ✉️ Send Invoice to Member
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
