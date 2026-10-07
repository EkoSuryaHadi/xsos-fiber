"use client";

import React from "react";
import styles from "./LifecycleViews.module.css";
import type { PortsSummary, SystemStatus } from "@/types/nms";

interface GlobalDashboardViewProps {
  summary: PortsSummary;
  systemStatus: SystemStatus;
  throughputTbps?: number;
  availabilityPct?: number;
  activeSessions?: number;
  onNavigateTab: (tab: "topology" | "bod" | "sla" | "billing" | "monitoring") => void;
}

export default function GlobalDashboardView({
  summary,
  systemStatus,
  throughputTbps = 1.83,
  availabilityPct = 99.997,
  activeSessions = 214,
  onNavigateTab,
}: GlobalDashboardViewProps) {
  const totalPorts = summary.total_ports || 1152;
  const connectedPorts = summary.connected_port || 742;
  const availablePorts = summary.available_ports || 386;
  const disabledPorts = summary.disabled_port || 24;
  const utilizedPct = ((connectedPorts / totalPorts) * 100).toFixed(1);

  return (
    <div className={styles.container}>
      {/* 1. Global KPI Metrics Strip */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>IXP Peering Ports Active</div>
          <div className={styles.kpiValue}>
            {connectedPorts} <span className={styles.kpiUnit}>/ {totalPorts}</span>
          </div>
          <div className={`${styles.kpiDelta} ${styles.deltaGood}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M4 15l6-6 4 4 6-8" />
            </svg>
            {utilizedPct}% utilized
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Aggregate Throughput</div>
          <div className={styles.kpiValue}>
            {throughputTbps.toFixed(2)} <span className={styles.kpiUnit}>Tbps</span>
          </div>
          <div className={`${styles.kpiDelta} ${styles.deltaGood}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M4 15l6-6 4 4 6-8" />
            </svg>
            +6.2% vs prior 24h
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Optical Fabric Availability</div>
          <div className={styles.kpiValue}>
            {availabilityPct.toFixed(3)}<span className={styles.kpiUnit}>%</span>
          </div>
          <div className={`${styles.kpiDelta} ${styles.deltaMuted}`}>
            Rolling 30-day target &gt; 99.99%
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Active Peering Sessions</div>
          <div className={styles.kpiValue}>{activeSessions}</div>
          <div className={`${styles.kpiDelta} ${styles.deltaMuted}`}>
            3 pending cross-connect
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Critical Hardware Alarms</div>
          <div className={styles.kpiValue} style={{ color: "#ef4444" }}>
            2
          </div>
          <div className={`${styles.kpiDelta} ${styles.deltaCrit}`}>
            1 Optical LOS · 1 Controller
          </div>
        </div>
      </div>

      {/* 2. Facility Status & Alarm Donut Row */}
      <div className={styles.row}>
        <div className={`${styles.card} ${styles.col2}`}>
          <div className={styles.cardHead}>
            <div className={styles.cardHeadTitles}>
              <div className={styles.cardTitle}>Facility &amp; Active Route Overview</div>
              <div className={styles.cardSub}>Existing Data Center · Live link status by building segment</div>
            </div>
            <button
              className={styles.badge}
              style={{ background: "#0284c7", color: "#fff", cursor: "pointer", border: "none" }}
              onClick={() => onNavigateTab("topology")}
              type="button"
            >
              Explore Topology ↗
            </button>
          </div>
          <div className={styles.cardBody} style={{ padding: "12px 16px" }}>
            <svg viewBox="0 0 620 280" style={{ width: "100%", height: "260px" }}>
              {/* 5th Floor */}
              <rect x="15" y="10" width="590" height="42" rx="4" fill="#0d1829" stroke="#1e2c47" />
              <text x="28" y="35" fontSize="11" fill="#94a3b8" fontWeight="600" fontFamily="sans-serif">
                5th Floor — Data Hall (Zone B) · Secondary Fabric MMR-B
              </text>

              {/* 3rd-4th Expansion Floor */}
              <rect x="15" y="58" width="590" height="38" rx="4" fill="#080e18" stroke="#162238" />
              <text x="28" y="82" fontSize="11" fill="#64748b" fontWeight="600" fontFamily="sans-serif">
                3rd – 4th Floor — Space for Future Expansion
              </text>

              {/* 2nd Floor MMR-A */}
              <rect x="15" y="102" width="590" height="46" rx="4" fill="rgba(16, 185, 129, 0.08)" stroke="#10b981" strokeWidth="1.5" />
              <text x="28" y="123" fontSize="11" fill="#34d399" fontWeight="700" fontFamily="sans-serif">
                2nd Floor — Data Hall (Zone A) — Primary IXP Meet-Me-Room (MMR-A)
              </text>
              <text x="28" y="138" fontSize="9.5" fill="#94a3b8" fontFamily="sans-serif">
                2× XSOS-576D robotic fabric · Member cross-connect distribution (276 fibers/MMR)
              </text>

              {/* 1st Floor Office */}
              <rect x="15" y="154" width="590" height="38" rx="4" fill="#0d1829" stroke="#1e2c47" />
              <text x="28" y="177" fontSize="11" fill="#94a3b8" fontWeight="600" fontFamily="sans-serif">
                1st Floor — Office A / Office B &amp; Carrier Interconnect
              </text>

              {/* Ground Floor MDF */}
              <rect x="15" y="198" width="590" height="46" rx="4" fill="#091120" stroke="#1e2c47" />
              <text x="28" y="219" fontSize="11" fill="#cbd5e1" fontWeight="700" fontFamily="sans-serif">
                Ground Floor — Telecom-A/B Rooms · MDF-1 / MDF-2 / MDF-3
              </text>
              <text x="28" y="234" fontSize="9.5" fill="#64748b" fontFamily="sans-serif">
                288 inbound fibers (3× 96-core) · 3× XSOS-576D robotic subracks
              </text>

              <text x="470" y="117" fontSize="9" fill="#94a3b8" fontFamily="sans-serif">
                MMR-A ⇄ MMR-B (24 tie-fibers)
              </text>
            </svg>
          </div>
        </div>

        <div className={`${styles.card} ${styles.col1}`}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Alarm Telemetry Breakdown</div>
            <span className={`${styles.badge} ${styles.badgeCrit}`}>
              <span className={styles.badgeDot} style={{ background: "#ef4444" }} />
              2 Critical
            </span>
          </div>
          <div className={styles.cardBody} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div className={styles.donutWrap}>
                <div
                  className={styles.donutCircle}
                  style={{
                    background: "conic-gradient(#ef4444 0% 28.5%, #f59e0b 28.5% 71.4%, #64748b 71.4% 100%)",
                  }}
                />
                <div className={styles.donutHole} />
                <div className={styles.donutContent}>
                  <div className={styles.donutTotal}>7</div>
                  <div className={styles.donutSub}>Total</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11.5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, background: "#ef4444", borderRadius: 2 }} />
                  <span>Critical · <strong>2</strong></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, background: "#f59e0b", borderRadius: 2 }} />
                  <span>Warning · <strong>3</strong></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, background: "#64748b", borderRadius: 2 }} />
                  <span>Informational · <strong>2</strong></span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ padding: "8px 10px", background: "rgba(239, 68, 68, 0.08)", borderLeft: "3px solid #ef4444", borderRadius: 3 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#f87171" }}>
                  Optical LOS — XSOS-576D-MMRB-02, Port 214
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>2 min ago · MMR-B, Zone B</div>
              </div>
              <div style={{ padding: "8px 10px", background: "rgba(239, 68, 68, 0.08)", borderLeft: "3px solid #ef4444", borderRadius: 3 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#f87171" }}>
                  IXP BoD Controller — API response degraded (842ms)
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>11 min ago · Control Plane</div>
              </div>
              <div style={{ padding: "8px 10px", background: "rgba(245, 158, 11, 0.08)", borderLeft: "3px solid #f59e0b", borderRadius: 3 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "#fbbf24" }}>
                  XSOS Matrix Latency above threshold, Rack R12
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>24 min ago · MMR-A</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 24h Exchange Throughput & Port Donut Row */}
      <div className={styles.row}>
        <div className={`${styles.card} ${styles.col2}`}>
          <div className={styles.cardHead}>
            <div className={styles.cardHeadTitles}>
              <div className={styles.cardTitle}>Aggregate Exchange Throughput (24h)</div>
              <div className={styles.cardSub}>10G / 100G / 400G peering circuits across all member ASNs</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 10, height: 3, background: "#0284c7" }} /> Real Throughput
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#7d8ea3" }}>
                <span style={{ width: 10, height: 1, background: "#64748b", borderTop: "1px dashed #64748b" }} /> Provisioned (2.0 Tbps)
              </span>
            </div>
          </div>
          <div className={styles.cardBody} style={{ padding: "10px 16px" }}>
            <svg viewBox="0 0 700 130" style={{ width: "100%", height: "115px" }}>
              <defs>
                <linearGradient id="tgrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <line x1="20" y1="15" x2="680" y2="15" stroke="#334155" strokeWidth="1.2" strokeDasharray="4 3" />
              <text x="685" y="18" fontSize="9" fill="#64748b" fontFamily="monospace">2.0T</text>
              <g transform="translate(20, 15)">
                <path
                  d="M0,60 L30,62 L60,63 L90,65 L120,65 L150,63 L180,58 L210,49 L240,38 L270,29 L300,23 L330,20 L360,19 L390,20 L420,21 L450,22 L480,19 L510,16 L540,18 L570,25 L600,34 L630,43 L660,57 L660,105 L0,105 Z"
                  fill="url(#tgrad)"
                />
                <path
                  d="M0,60 L30,62 L60,63 L90,65 L120,65 L150,63 L180,58 L210,49 L240,38 L270,29 L300,23 L330,20 L360,19 L390,20 L420,21 L450,22 L480,19 L510,16 L540,18 L570,25 L600,34 L630,43 L660,57"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="2.2"
                />
                <circle cx="510" cy="16" r="3.5" fill="#ffffff" stroke="#0284c7" strokeWidth="2" />
                <text x="510" y="8" fontSize="9" fill="#38bdf8" fontWeight="700" fontFamily="monospace" textAnchor="middle">
                  1.89 Tbps Peak
                </text>
              </g>
              <text x="25" y="125" fontSize="9" fill="#64748b" fontFamily="monospace">00:00</text>
              <text x="350" y="125" fontSize="9" fill="#64748b" fontFamily="monospace" textAnchor="middle">12:00</text>
              <text x="675" y="125" fontSize="9" fill="#64748b" fontFamily="monospace" textAnchor="end">23:59</text>
            </svg>
          </div>
        </div>

        <div className={`${styles.card} ${styles.col1}`}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Optical Fabric Port Summary</div>
            <div className={styles.cardSub}>7× XSOS-576D subracks</div>
          </div>
          <div className={styles.cardBody} style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div className={styles.donutWrap}>
              <div
                className={styles.donutCircle}
                style={{
                  background: `conic-gradient(#10b981 0% ${utilizedPct}%, #0284c7 ${utilizedPct}% 97.9%, #475569 97.9% 100%)`,
                }}
              />
              <div className={styles.donutHole} />
              <div className={styles.donutContent}>
                <div className={styles.donutTotal}>{totalPorts}</div>
                <div className={styles.donutSub}>Ports</div>
              </div>
            </div>

            <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 8, fontSize: 11.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, background: "#10b981", borderRadius: 2 }} />
                  Connected
                </span>
                <strong className={styles.mono}>{connectedPorts}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, background: "#0284c7", borderRadius: 2 }} />
                  Available
                </span>
                <strong className={styles.mono}>{availablePorts}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, background: "#475569", borderRadius: 2 }} />
                  Disabled
                </span>
                <strong className={styles.mono}>{disabledPorts}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
