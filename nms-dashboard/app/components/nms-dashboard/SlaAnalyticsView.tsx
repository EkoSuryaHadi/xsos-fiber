"use client";

import React, { useState, useEffect } from "react";
import styles from "./SlaAnalyticsView.module.css";
import { fetchSlaCompliance, fetchTelemetryStatus } from "@/lib/business-api";

interface SlaRecord {
  endUserType: string;
  slaTier: "Gold" | "Platinum" | "Silver";
  uptimeTarget: string;
  actualUptime: string;
  latencyTarget: string;
  actualLatency: string;
  status: "Good" | "Watch";
}

const BASELINE_SLA_COMPLIANCE: SlaRecord[] = [
  {
    endUserType: "Hyperscaler",
    slaTier: "Gold",
    uptimeTarget: "99.99%",
    actualUptime: "99.995%",
    latencyTarget: "< 2 ms",
    actualLatency: "1.4 ms",
    status: "Good",
  },
  {
    endUserType: "CDN",
    slaTier: "Gold",
    uptimeTarget: "99.99%",
    actualUptime: "99.992%",
    latencyTarget: "< 2 ms",
    actualLatency: "1.6 ms",
    status: "Good",
  },
  {
    endUserType: "FSI (Financial Services)",
    slaTier: "Platinum",
    uptimeTarget: "99.999%",
    actualUptime: "99.997%",
    latencyTarget: "< 1 ms",
    actualLatency: "1.2 ms",
    status: "Watch",
  },
  {
    endUserType: "Enterprise",
    slaTier: "Silver",
    uptimeTarget: "99.95%",
    actualUptime: "99.968%",
    latencyTarget: "< 5 ms",
    actualLatency: "2.1 ms",
    status: "Good",
  },
];

export default function SlaAnalyticsView() {
  const [slaList, setSlaList] = useState<SlaRecord[]>(BASELINE_SLA_COMPLIANCE);
  const [latencyVal, setLatencyVal] = useState<number>(1.2);
  const [jitterVal, setJitterVal] = useState<number>(0.14);
  const [packetLossVal, setPacketLossVal] = useState<number>(0.02);
  const [netconfMs, setNetconfMs] = useState<number>(162);
  const [restApiMs, setRestApiMs] = useState<number>(239);
  const [licenseUsage, setLicenseUsage] = useState<string>("689/900");

  useEffect(() => {
    let isMounted = true;
    async function loadLiveData() {
      try {
        const [compData, telemData] = await Promise.all([
          fetchSlaCompliance().catch(() => null),
          fetchTelemetryStatus().catch(() => null),
        ]);
        if (isMounted) {
          if (compData && compData.length > 0) {
            const mapped = compData.map((c) => ({
              endUserType: c.customerType,
              slaTier: c.slaTier as "Gold" | "Platinum" | "Silver",
              uptimeTarget: `${c.uptimeTargetPct}%`,
              actualUptime: `${c.actualUptimePct}%`,
              latencyTarget: `< ${c.latencyTargetMs} ms`,
              actualLatency: `${c.actualLatencyMs} ms`,
              status: (c.status === "Good" ? "Good" : "Watch") as "Good" | "Watch",
            }));
            setSlaList(mapped);
          }
          if (telemData) {
            if (telemData.avg_response_ms) setNetconfMs(Math.round(telemData.avg_response_ms));
            if (telemData.p95_response_ms) setRestApiMs(Math.round(telemData.p95_response_ms));
          }
        }
      } catch (err) {
        console.warn("Using baseline SLA analytics data:", err);
      }
    }
    loadLiveData();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className={styles.container}>
      {/* ====================================================================
          1. TOP 3 METRIC CARDS WITH SPARKLINE AREA CHARTS
          ==================================================================== */}
      <div className={styles.metricGrid}>
        {/* Card 1: Latency */}
        <div className={styles.metricCard}>
          <div className={styles.metricHead}>
            <div className={styles.metricTitle}>Latency</div>
            <div className={styles.miniv} style={{ color: "#2a78d6" }}>
              {latencyVal.toFixed(1)} <span className={styles.minivSub}>ms avg</span>
            </div>
          </div>
          <div className={styles.metricBody}>
            <svg viewBox="0 0 200 90" style={{ width: "100%", height: "76px" }}>
              <defs>
                <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2a78d6" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#2a78d6" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <line x1="0" y1="9.6" x2="200" y2="9.6" stroke="#C7CFD7" strokeWidth="1" strokeDasharray="4 3" />
              <text x="198" y="8" fontSize="8" fill="#8B98A5" fontFamily="IBM Plex Mono, monospace" textAnchor="end">
                2.0ms target
              </text>
              <path
                d="M0.0,54.6 L8.7,57.9 L17.4,61.1 L26.1,61.1 L34.8,61.1 L43.5,57.9 L52.2,51.4 L60.9,41.8 L69.6,32.1 L78.3,25.7 L87.0,22.5 L95.7,19.3 L104.3,16.1 L113.0,19.3 L121.7,22.5 L130.4,25.7 L139.1,22.5 L147.8,19.3 L156.5,25.7 L165.2,35.4 L173.9,45.0 L182.6,48.2 L191.3,51.4 L200.0,54.6 L200.0,90 L0.0,90 Z"
                fill="url(#latencyGradient)"
              />
              <path
                d="M0.0,54.6 L8.7,57.9 L17.4,61.1 L26.1,61.1 L34.8,61.1 L43.5,57.9 L52.2,51.4 L60.9,41.8 L69.6,32.1 L78.3,25.7 L87.0,22.5 L95.7,19.3 L104.3,16.1 L113.0,19.3 L121.7,22.5 L130.4,25.7 L139.1,22.5 L147.8,19.3 L156.5,25.7 L165.2,35.4 L173.9,45.0 L182.6,48.2 L191.3,51.4 L200.0,54.6"
                fill="none"
                stroke="#2a78d6"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: Jitter */}
        <div className={styles.metricCard}>
          <div className={styles.metricHead}>
            <div className={styles.metricTitle}>Jitter</div>
            <div className={styles.miniv} style={{ color: "#1baf7a" }}>
              {jitterVal.toFixed(2)} <span className={styles.minivSub}>ms avg</span>
            </div>
          </div>
          <div className={styles.metricBody}>
            <svg viewBox="0 0 200 90" style={{ width: "100%", height: "76px" }}>
              <defs>
                <linearGradient id="jitterGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1baf7a" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#1baf7a" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <line x1="0" y1="11.3" x2="200" y2="11.3" stroke="#C7CFD7" strokeWidth="1" strokeDasharray="4 3" />
              <text x="198" y="9.5" fontSize="8" fill="#8B98A5" fontFamily="IBM Plex Mono, monospace" textAnchor="end">
                0.5ms target
              </text>
              <path
                d="M0.0,69.8 L8.7,72.0 L17.4,74.2 L26.1,74.2 L34.8,72.0 L43.5,69.8 L52.2,65.2 L60.9,58.5 L69.6,51.8 L78.3,47.2 L87.0,45.0 L95.7,42.8 L104.3,40.5 L113.0,42.8 L121.7,45.0 L130.4,47.2 L139.1,45.0 L147.8,42.8 L156.5,47.2 L165.2,54.0 L173.9,60.8 L182.6,65.2 L191.3,67.5 L200.0,69.8 L200.0,90 L0.0,90 Z"
                fill="url(#jitterGradient)"
              />
              <path
                d="M0.0,69.8 L8.7,72.0 L17.4,74.2 L26.1,74.2 L34.8,72.0 L43.5,69.8 L52.2,65.2 L60.9,58.5 L69.6,51.8 L78.3,47.2 L87.0,45.0 L95.7,42.8 L104.3,40.5 L113.0,42.8 L121.7,45.0 L130.4,47.2 L139.1,45.0 L147.8,42.8 L156.5,47.2 L165.2,54.0 L173.9,60.8 L182.6,65.2 L191.3,67.5 L200.0,69.8"
                fill="none"
                stroke="#1baf7a"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Packet Loss */}
        <div className={styles.metricCard}>
          <div className={styles.metricHead}>
            <div className={styles.metricTitle}>Packet Loss</div>
            <div className={styles.miniv} style={{ color: "#eb6834" }}>
              {packetLossVal.toFixed(2)} <span className={styles.minivSub}>% avg</span>
            </div>
          </div>
          <div className={styles.metricBody}>
            <svg viewBox="0 0 200 90" style={{ width: "100%", height: "76px" }}>
              <defs>
                <linearGradient id="packetLossGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#eb6834" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#eb6834" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <line x1="0" y1="15" x2="200" y2="15" stroke="#C7CFD7" strokeWidth="1" strokeDasharray="4 3" />
              <text x="198" y="13" fontSize="8" fill="#8B98A5" fontFamily="IBM Plex Mono, monospace" textAnchor="end">
                0.05% target
              </text>
              <path
                d="M0.0,90.0 L8.7,90.0 L17.4,90.0 L26.1,90.0 L34.8,90.0 L43.5,90.0 L52.2,90.0 L60.9,75.0 L69.6,75.0 L78.3,60.0 L87.0,60.0 L95.7,45.0 L104.3,30.0 L113.0,45.0 L121.7,60.0 L130.4,60.0 L139.1,75.0 L147.8,75.0 L156.5,60.0 L165.2,75.0 L173.9,90.0 L182.6,90.0 L191.3,90.0 L200.0,90.0 L200.0,90 L0.0,90 Z"
                fill="url(#packetLossGradient)"
              />
              <path
                d="M0.0,90.0 L8.7,90.0 L17.4,90.0 L26.1,90.0 L34.8,90.0 L43.5,90.0 L52.2,90.0 L60.9,75.0 L69.6,75.0 L78.3,60.0 L87.0,60.0 L95.7,45.0 L104.3,30.0 L113.0,45.0 L121.7,60.0 L130.4,60.0 L139.1,75.0 L147.8,75.0 L156.5,60.0 L165.2,75.0 L173.9,90.0 L182.6,90.0 L191.3,90.0 L200.0,90.0"
                fill="none"
                stroke="#eb6834"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ====================================================================
          2. MAIN ROW: SLA COMPLIANCE TABLE + PREDICTIVE WARNINGS
          ==================================================================== */}
      <div className={styles.row}>
        {/* Left: SLA Compliance by End-User Type */}
        <div className={`${styles.card} ${styles.col2}`}>
          <div className={styles.cardHead}>
            <div>
              <div className={styles.cardTitle}>SLA Compliance by End-User Type</div>
              <div className={styles.cardSub}>Rolling 30-day · IXP peering fabric</div>
            </div>
          </div>
          <div className={styles.cardBody} style={{ padding: 0 }}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>End-User Type</th>
                    <th>SLA Tier</th>
                    <th>Uptime Target</th>
                    <th>Actual Uptime</th>
                    <th>Latency Target</th>
                    <th>Actual Latency</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {slaList.map((row) => (
                    <tr key={row.endUserType}>
                      <td>
                        <strong>{row.endUserType}</strong>
                      </td>
                      <td>{row.slaTier}</td>
                      <td className={styles.mono}>{row.uptimeTarget}</td>
                      <td className={styles.mono} style={{ fontWeight: 700 }}>
                        {row.actualUptime}
                      </td>
                      <td className={styles.mono}>{row.latencyTarget}</td>
                      <td className={styles.mono}>{row.actualLatency}</td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            row.status === "Good" ? styles.badgeGood : styles.badgeWarning
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Predictive Failure Warnings & 2x2 Telemetry Grid */}
        <div className={`${styles.card} ${styles.col1}`}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Predictive Failure Warnings</div>
          </div>

          <div className={styles.cardBody} style={{ display: "flex", flexDirection: "column" }}>
            {/* Warning 1 */}
            <div className={styles.predrow}>
              <span className={`${styles.badge} ${styles.badgeWarning} ${styles.predtag}`}>Low</span>
              <div>
                <div className={styles.predtitle}>XSOS-576D-MDF2 — elevated retry rate, Module 14</div>
                <div className={styles.predsub}>Forecast risk window: 30 days</div>
              </div>
            </div>

            {/* Warning 2 */}
            <div className={styles.predrow}>
              <span className={`${styles.badge} ${styles.badgeWarning} ${styles.predtag}`}>Low</span>
              <div>
                <div className={styles.predtitle}>XSOS-576D-MMRB-02 — thermal drift, Robotic Unit</div>
                <div className={styles.predsub}>Forecast risk window: 45 days</div>
              </div>
            </div>

            {/* Warning 3 */}
            <div className={styles.predrow}>
              <span className={`${styles.badge} ${styles.badgeGood} ${styles.predtag}`}>Nominal</span>
              <div>
                <div className={styles.predtitle}>SDN Core — no anomalies in log analysis</div>
                <div className={styles.predsub}>Last scan: 6 minutes ago</div>
              </div>
            </div>

            {/* 2x2 KPI Telemetry Chips */}
            <div className={styles.stat2}>
              <div className={styles.statTile}>
                <div className={styles.statLabel}>NetConf Avg Response</div>
                <div className={styles.statValue}>{netconfMs} ms</div>
              </div>
              <div className={styles.statTile}>
                <div className={styles.statLabel}>REST API P95</div>
                <div className={styles.statValue}>{restApiMs} ms</div>
              </div>
              <div className={styles.statTile}>
                <div className={styles.statLabel}>EMS DB Sync</div>
                <div className={styles.statValue} style={{ color: "#0ca30c" }}>
                  Healthy
                </div>
              </div>
              <div className={styles.statTile}>
                <div className={styles.statLabel}>License Usage</div>
                <div className={styles.statValue}>{licenseUsage}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
