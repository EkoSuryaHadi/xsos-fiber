"use client";

import React, { useState, useEffect } from "react";
import styles from "./BodOrchestratorView.module.css";
import type { BodRequestItem, CapacityType, SlaTierType, TenantCustomer } from "@/types/lifecycle";
import { INITIAL_TENANTS } from "@/lib/lifecycle-data";
import { fetchBodRequests, createBodRequest, updateBodStage, fetchTenants } from "@/lib/business-api";

interface BodOrchestratorViewProps {
  onDispatchConnect: (params: {
    source_panel_name: string;
    source_port_no: number[];
    target_panel_name: string;
    target_port_no: number[];
    route: number;
    customer?: string;
  }) => Promise<void>;
  readOnly?: boolean;
}

// Initial baseline requests matching IXP prototype screenshot
const BASELINE_BOD_REQUESTS: BodRequestItem[] = [
  {
    id: "BOD-40236",
    tenantId: "TNT-003",
    tenantName: "Netflix Open Connect",
    route: "MMR-B/R22 — Fabric-02",
    sourcePanel: "XSOS-576D-2",
    sourcePort: 22,
    targetPanel: "XSOS-576D-1",
    targetPort: 110,
    capacity: "100G",
    slaTier: "Bronze",
    duration: "Recurring",
    stage: 2, // Actuating
    submittedAt: "09:22",
    insertionLossDb: 0.44,
    returnLossDb: -66.0,
    estSwitchingTimeSec: 42,
    monthlyCost: 1240,
    autoApproved: true,
  },
  {
    id: "BOD-40235",
    tenantId: "TNT-001",
    tenantName: "Google Global Cache",
    route: "MMR-A/R21 — Fabric-01",
    sourcePanel: "XSOS-576D-1",
    sourcePort: 18,
    targetPanel: "XSOS-576D-2",
    targetPort: 142,
    capacity: "100G",
    slaTier: "Gold",
    duration: "Recurring",
    stage: 3, // Active
    submittedAt: "09:22",
    insertionLossDb: 0.42,
    returnLossDb: -66.5,
    estSwitchingTimeSec: 38,
    monthlyCost: 1240,
    autoApproved: true,
  },
  {
    id: "BOD-40234",
    tenantId: "TNT-002",
    tenantName: "AWS Direct Connect",
    route: "MMR-A/R21 — Fabric-01",
    sourcePanel: "XSOS-576D-1",
    sourcePort: 24,
    targetPanel: "XSOS-576D-2",
    targetPort: 145,
    capacity: "100G",
    slaTier: "Gold",
    duration: "Recurring",
    stage: 2, // Actuating
    submittedAt: "09:22",
    insertionLossDb: 0.43,
    returnLossDb: -66.2,
    estSwitchingTimeSec: 40,
    monthlyCost: 1240,
    autoApproved: true,
  },
  {
    id: "BOD-40233",
    tenantId: "TNT-004",
    tenantName: "Meta Edge Network",
    route: "MMR-B/R22 — Fabric-02",
    sourcePanel: "XSOS-576D-2",
    sourcePort: 45,
    targetPanel: "XSOS-576D-1",
    targetPort: 88,
    capacity: "100G",
    slaTier: "Bronze",
    duration: "Recurring",
    stage: 2, // Actuating
    submittedAt: "09:22",
    insertionLossDb: 0.45,
    returnLossDb: -65.9,
    estSwitchingTimeSec: 42,
    monthlyCost: 1240,
    autoApproved: true,
  },
  {
    id: "BOD-40232",
    tenantId: "TNT-005",
    tenantName: "Singtel Carrier Core",
    route: "MMR-B/R22 — Fabric-02",
    sourcePanel: "XSOS-576D-2",
    sourcePort: 50,
    targetPanel: "XSOS-576D-1",
    targetPort: 92,
    capacity: "100G",
    slaTier: "Bronze",
    duration: "Recurring",
    stage: 1, // Configuring Hardware
    submittedAt: "09:22",
    insertionLossDb: 0.46,
    returnLossDb: -66.0,
    estSwitchingTimeSec: 45,
    monthlyCost: 1240,
    autoApproved: true,
  },
];

export default function BodOrchestratorView({
  onDispatchConnect,
  readOnly = false,
}: BodOrchestratorViewProps) {
  const [requests, setRequests] = useState<BodRequestItem[]>(BASELINE_BOD_REQUESTS);
  const [tenants, setTenants] = useState<TenantCustomer[]>(INITIAL_TENANTS);

  // Form Fields matching screenshot
  const [sourceInput, setSourceInput] = useState<string>("Member Rack — MMR-A / R08-12");
  const [destInput, setDestInput] = useState<string>("IXP Peering Fabric — XSOS-576D-MMRA-01");
  const [capacity, setCapacity] = useState<CapacityType>("100G");
  const [duration, setDuration] = useState<string>("Recurring");
  const [slaTier, setSlaTier] = useState<SlaTierType>("Gold");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [monthCount, setMonthCount] = useState<number>(147);

  // Load backend requests on mount
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [liveReqs, liveTenants] = await Promise.all([
          fetchBodRequests().catch(() => null),
          fetchTenants().catch(() => null),
        ]);
        if (isMounted) {
          if (liveReqs && liveReqs.length > 0) {
            setRequests(liveReqs);
            setMonthCount(147 + liveReqs.length);
          }
          if (liveTenants && liveTenants.length > 0) {
            setTenants(liveTenants);
          }
        }
      } catch (err) {
        console.warn("Using baseline BoD requests data:", err);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Feasibility budget calculations
  const insertionLoss = capacity === "400G" ? 0.48 : capacity === "100G" ? 0.46 : 0.38;
  const returnLoss = capacity === "400G" ? -67 : capacity === "100G" ? -66 : -65;
  const estCost = capacity === "400G" ? 3500 : capacity === "100G" ? 1240 : 300;

  const handleSubmit = async () => {
    if (readOnly) {
      alert("Mode Audit Viewer aktif: Permintaan provisioning diblokir.");
      return;
    }

    setIsSubmitting(true);
    const newId = `BOD-${Math.floor(40237 + Math.random() * 50)}`;
    const nowTime = new Date().toTimeString().slice(0, 5);

    const newReq: BodRequestItem = {
      id: newId,
      tenantId: "TNT-001",
      tenantName: "Google Global Cache",
      route: `${sourceInput.split("—")[1]?.trim() || "MMR-A/R08"} ──▶ Fabric-01`,
      sourcePanel: "XSOS-576D-1",
      sourcePort: 18,
      targetPanel: "XSOS-576D-2",
      targetPort: 142,
      capacity,
      slaTier,
      duration: duration as "Recurring",
      stage: 0, // Validating
      submittedAt: nowTime,
      insertionLossDb: insertionLoss,
      returnLossDb: returnLoss,
      estSwitchingTimeSec: 42,
      monthlyCost: estCost,
      autoApproved: true,
    };

    setRequests((prev) => [newReq, ...prev]);
    setMonthCount((prev) => prev + 1);

    try {
      await onDispatchConnect({
        source_panel_name: "XSOS-576D-1",
        source_port_no: [18],
        target_panel_name: "XSOS-576D-2",
        target_port_no: [142],
        route: 0,
        customer: "Google Global Cache",
      });

      // Try saving to backend DB
      createBodRequest({
        tenant_id: "TNT-001",
        route: newReq.route,
        source_panel: "XSOS-576D-1",
        source_port: 18,
        target_panel: "XSOS-576D-2",
        target_port: 142,
        capacity,
        sla_tier: slaTier,
        duration: "Recurring",
        insertion_loss_db: insertionLoss,
        return_loss_db: returnLoss,
        est_switching_time_sec: 42,
        monthly_cost: estCost,
      }).catch(() => {});

      // Simulate multi-stage robotic provisioning progression
      setTimeout(() => {
        setRequests((prev) =>
          prev.map((r) => (r.id === newId ? { ...r, stage: 1 } : r))
        );
      }, 1500);

      setTimeout(() => {
        setRequests((prev) =>
          prev.map((r) => (r.id === newId ? { ...r, stage: 2 } : r))
        );
      }, 3200);

      setTimeout(() => {
        setRequests((prev) =>
          prev.map((r) => (r.id === newId ? { ...r, stage: 3 } : r))
        );
      }, 5500);
    } catch {
      // optimistic fallback already added
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to render 4-stage stepper
  const renderWorkflowStepper = (stage: number) => {
    // Stage 0 = Validating (step 1 cur, 2-4 pending)
    // Stage 1 = Configuring Hardware (step 1 done, step 2 cur, 3-4 pending)
    // Stage 2 = Actuating (step 1-2 done, step 3 cur, step 4 pending)
    // Stage 3 = Active (step 1-4 done)
    const isStep1Done = stage >= 1;
    const isStep1Cur = stage === 0;

    const isStep2Done = stage >= 2;
    const isStep2Cur = stage === 1;

    const isStep3Done = stage >= 3;
    const isStep3Cur = stage === 2;

    const isStep4Done = stage >= 3;

    const labelText =
      stage === 3
        ? "Active"
        : stage === 2
        ? "Actuating"
        : stage === 1
        ? "Configuring Hardware"
        : "Validating";

    return (
      <div className={styles.stepperWrap}>
        <div className={styles.stepper}>
          {/* Step 1 */}
          <div
            className={`${styles.stepDot} ${
              isStep1Done ? styles.stepDotDone : isStep1Cur ? styles.stepDotCur : styles.stepDotPending
            }`}
          >
            {isStep1Done ? "✓" : isStep1Cur ? "●" : "1"}
          </div>
          <div className={`${styles.stepLine} ${isStep1Done ? styles.stepLineDone : ""}`} />

          {/* Step 2 */}
          <div
            className={`${styles.stepDot} ${
              isStep2Done ? styles.stepDotDone : isStep2Cur ? styles.stepDotCur : styles.stepDotPending
            }`}
          >
            {isStep2Done ? "✓" : isStep2Cur ? "●" : "2"}
          </div>
          <div className={`${styles.stepLine} ${isStep2Done ? styles.stepLineDone : ""}`} />

          {/* Step 3 */}
          <div
            className={`${styles.stepDot} ${
              isStep3Done ? styles.stepDotDone : isStep3Cur ? styles.stepDotCur : styles.stepDotPending
            }`}
          >
            {isStep3Done ? "✓" : isStep3Cur ? "●" : "3"}
          </div>
          <div className={`${styles.stepLine} ${isStep3Done ? styles.stepLineDone : ""}`} />

          {/* Step 4 */}
          <div className={`${styles.stepDot} ${isStep4Done ? styles.stepDotDone : styles.stepDotPending}`}>
            {isStep4Done ? "✓" : "4"}
          </div>
        </div>
        <div
          className={`${styles.stepLabel} ${
            stage === 3 ? styles.stepLabelActive : styles.stepLabelCur
          }`}
        >
          {labelText}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* ====================================================================
          1. TOP MAIN ROW (REQUEST FORM + ACTIVE REQUESTS TABLE)
          ==================================================================== */}
      <div className={styles.row}>
        {/* Left: New Cross-Connect Request Card */}
        <div className={`${styles.card} ${styles.colForm}`}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>New Cross-Connect Request</div>
          </div>

          <div className={styles.cardBody} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* SOURCE */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Source</label>
              <input
                type="text"
                className={styles.input}
                value={sourceInput}
                onChange={(e) => setSourceInput(e.target.value)}
              />
            </div>

            {/* DESTINATION */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Destination</label>
              <input
                type="text"
                className={styles.input}
                value={destInput}
                onChange={(e) => setDestInput(e.target.value)}
              />
            </div>

            {/* CAPACITY */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Capacity</label>
              <div className={styles.pillrow}>
                {(["10G", "100G", "400G"] as const).map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    className={`${styles.pill} ${capacity === cap ? styles.pillSel : ""}`}
                    onClick={() => setCapacity(cap)}
                  >
                    {cap}
                  </button>
                ))}
              </div>
            </div>

            {/* DURATION & SLA TIER */}
            <div className={styles.fieldrow}>
              <div className={styles.field} style={{ flex: 1 }}>
                <label className={styles.fieldLabel}>Duration</label>
                <input
                  type="text"
                  className={styles.input}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
              <div className={styles.field} style={{ flex: 1 }}>
                <label className={styles.fieldLabel}>SLA Tier</label>
                <input
                  type="text"
                  className={styles.input}
                  value={slaTier}
                  onChange={(e) => setSlaTier(e.target.value as SlaTierType)}
                />
              </div>
            </div>

            {/* OPTICAL FEASIBILITY CARD */}
            <div className={styles.feascard}>
              <div className={styles.feasHead}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3E6B12" strokeWidth="3">
                  <path d="M4 12l5 5L20 6" />
                </svg>
                <span>Feasible — within XSOS-576D optical budget</span>
              </div>
              <div className={styles.feasrow}>
                <span>Est. Insertion Loss</span>
                <span className={styles.feasval}>
                  {insertionLoss.toFixed(2)} dB <span className={styles.feasspec}>(spec ≤0.5)</span>
                </span>
              </div>
              <div className={styles.feasrow}>
                <span>Est. Return Loss</span>
                <span className={styles.feasval}>
                  {returnLoss} dB <span className={styles.feasspec}>(spec ≤-65)</span>
                </span>
              </div>
              <div className={styles.feasrow}>
                <span>Est. Switching Time</span>
                <span className={styles.feasval}>
                  42 sec <span className={styles.feasspec}>(spec 25–60)</span>
                </span>
              </div>
              <div className={styles.feasrow}>
                <span>Estimated Cost</span>
                <span className={styles.feasval}>${estCost.toLocaleString()} / mo</span>
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? "Queueing Robot..." : "Submit for Provisioning"}
            </button>
          </div>
        </div>

        {/* Right: Active & Recent Requests Card */}
        <div className={`${styles.card} ${styles.colTable}`}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Active &amp; Recent Requests</div>
            <span className={`${styles.badge} ${styles.badgeNeutral}`}>{monthCount} this month</span>
          </div>

          <div className={styles.cardBody} style={{ padding: 0 }}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Source ──▶ Destination</th>
                    <th>Capacity</th>
                    <th>SLA</th>
                    <th style={{ width: 220 }}>Workflow</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.slice(0, 5).map((r) => (
                    <tr key={r.id}>
                      <td className={styles.mono} style={{ fontWeight: 700 }}>
                        {r.id}
                      </td>
                      <td>{r.route}</td>
                      <td className={styles.mono}>{r.capacity}</td>
                      <td>{r.slaTier}</td>
                      <td>{renderWorkflowStepper(r.stage)}</td>
                      <td className={styles.mono}>{r.submittedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          2. BOTTOM STATS ROW (3 STAT CARDS)
          ==================================================================== */}
      <div className={styles.stat3}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Avg. Provisioning Time</div>
          <div className={styles.statValue}>3m 4s</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Requests This Month</div>
          <div className={styles.statValue}>{monthCount}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Auto-Approved (Below Threshold)</div>
          <div className={styles.statValue}>94%</div>
        </div>
      </div>
    </div>
  );
}
