"use client";

import React, { useState, useEffect } from "react";
import styles from "./OptionA.module.css";
import NetworkTopologyView from "./NetworkTopologyView";
import BodOrchestratorView from "./BodOrchestratorView";
import SlaAnalyticsView from "./SlaAnalyticsView";
import FaultsEventsView from "./FaultsEventsView";
import CrmBillingView from "./CrmBillingView";
import type { PortsSummary, SystemStatus, Port } from "@/types/nms";
import type { BodRequestItem } from "@/types/lifecycle";
import { INITIAL_BOD_REQUESTS } from "@/lib/lifecycle-data";
import { fetchOutageIncidents, fetchFacilityFloors, type FacilityFloor } from "@/lib/business-api";

interface OptionASinglePageViewProps {
  summary: PortsSummary;
  systemStatus: SystemStatus;
  ports: Record<string, Port>;
  mode?: "live" | "demo";
  isStreaming?: boolean;
  onRefresh?: () => void;
  lastSyncAt?: string | null;
  userRole?: "operator" | "readonly";
  onDispatchConnect: (params: {
    source_panel_name: string;
    source_port_no: number[];
    target_panel_name: string;
    target_port_no: number[];
    route: number;
    customer?: string;
  }) => Promise<void>;
  onOpenConnectModal?: () => void;
  onOpenRawBay?: () => void;
  onOpenSettings?: () => void;
  onOpenLogs?: () => void;
}

export default function OptionASinglePageView({
  summary,
  systemStatus,
  ports,
  mode = "demo",
  isStreaming = false,
  onRefresh,
  lastSyncAt,
  userRole = "operator",
  onDispatchConnect,
  onOpenConnectModal,
  onOpenRawBay,
  onOpenSettings,
  onOpenLogs,
}: OptionASinglePageViewProps) {
  const [activeSection, setActiveSection] = useState<string>("sec-overview");
  const [clockStr, setClockStr] = useState<string>("");
  const [liveIncidents, setLiveIncidents] = useState<any[]>([]);
  const [facilityFloors, setFacilityFloors] = useState<FacilityFloor[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string>("2nd");

  // Load facility floors data from API
  useEffect(() => {
    let isMounted = true;
    fetchFacilityFloors()
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setFacilityFloors(data);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [lastSyncAt]);

  // Load live outage incidents for alarms card
  useEffect(() => {
    let isMounted = true;
    fetchOutageIncidents()
      .then((data) => {
        if (isMounted && data && Array.isArray(data) && data.length > 0) {
          setLiveIncidents(data);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [lastSyncAt]);

  // Section 3 BoD State
  const [bodSource, setBodSource] = useState<string>("MMR-A / R08-12");
  const [bodCapacity, setBodCapacity] = useState<"10G" | "100G" | "400G">("100G");
  const [bodRequests, setBodRequests] = useState<BodRequestItem[]>(INITIAL_BOD_REQUESTS);
  const [bodSubmitting, setBodSubmitting] = useState<boolean>(false);

  // Live Clock Updater
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const pad = (n: number) => String(n).padStart(2, "0");
      const s = `${days[d.getDay()]} ${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} SGT`;
      setClockStr(s);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Jump smoothly to a section
  const jumpTo = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Auto-track active section on scroll
  useEffect(() => {
    const sectionIds = [
      "sec-overview",
      "sec-topology",
      "sec-bod",
      "sec-analytics",
      "sec-faults",
      "sec-billing",
    ];

    const handleScroll = () => {
      const scrollY = window.scrollY + 100;
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollY >= top && scrollY < top + height) {
            setActiveSection(id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleBodSubmit = async () => {
    setBodSubmitting(true);
    const newId = `BOD-${Math.floor(40218 + Math.random() * 50)}`;
    const newReq: BodRequestItem = {
      id: newId,
      tenantId: "TNT-001",
      tenantName: "Google Global Cache",
      route: `${bodSource} ──▶ Fabric-01`,
      sourcePanel: "XSOS-576D-1",
      sourcePort: 18,
      targetPanel: "XSOS-576D-2",
      targetPort: 142,
      capacity: bodCapacity,
      slaTier: "Gold",
      duration: "Recurring",
      stage: 1, // Configuring
      submittedAt: new Date().toTimeString().slice(0, 5),
      insertionLossDb: 0.44,
      returnLossDb: -66.5,
      estSwitchingTimeSec: 42,
      monthlyCost: bodCapacity === "400G" ? 3500 : bodCapacity === "100G" ? 1200 : 300,
      autoApproved: true,
    };

    try {
      await onDispatchConnect({
        source_panel_name: "XSOS-576D-1",
        source_port_no: [18],
        target_panel_name: "XSOS-576D-2",
        target_port_no: [142],
        route: 0,
        customer: "Google Global Cache",
      });
      setBodRequests((prev) => [newReq, ...prev]);

      setTimeout(() => {
        setBodRequests((prev) =>
          prev.map((r) => (r.id === newId ? { ...r, stage: 3 } : r))
        );
      }, 4000);
    } catch {
      // optimistic demo addition
      setBodRequests((prev) => [newReq, ...prev]);
    } finally {
      setBodSubmitting(false);
    }
  };

  return (
    <div className={styles.pageWrap}>
      {/* ====================================================================
          1. TOP MASTHEAD (Exact match to prompt screenshot)
          ==================================================================== */}
      <header className={styles.topbar}>
        <div className={styles.brand}>
          {/* Authentic fiber cross-connect shield logo */}
          <svg className={styles.brandLogo} viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="6" fill="#002244" />
            <path d="M6 16L16 6L26 16L16 26Z" stroke="#8BC53E" strokeWidth="2.5" />
            <circle cx="16" cy="16" r="3.5" fill="#8BC53E" />
            <path d="M16 6V12M16 20V26M6 16H12M20 16H26" stroke="#8BC53E" strokeWidth="2" />
          </svg>
          <div className={styles.brandName}>POINTS&nbsp;OF&nbsp;PRESENCE</div>
          <div className={styles.brandDivider} />
          <div className={styles.portalName}>IXP Orchestration Portal</div>
        </div>

        <div className={styles.topbarRight}>
          <div className={isStreaming ? styles.liveBadgeStream : mode === "live" ? styles.liveBadge : styles.liveBadgeDemo}>
            <span className={mode === "live" || isStreaming ? styles.liveDot : styles.liveDotDemo} />
            {isStreaming ? "● LIVE STREAM (SSE)" : mode === "live" ? "● LIVE NOC API" : "● DEMO SIMULATOR"}
          </div>
          {onRefresh && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                className={styles.refreshBtn}
                onClick={onRefresh}
                title="Sync live hardware telemetry from Xenoptics NMS"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                Sync
              </button>
              <span style={{ fontSize: "10.5px", color: isStreaming ? "#8BC53E" : "#8BA7C4", fontFamily: "var(--font-mono, monospace)", whiteSpace: "nowrap" }}>
                {isStreaming ? "Push: ~2s" : "Auto: 8s"}
              </span>
            </div>
          )}
          <div className={styles.siteChip}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8BC53E" strokeWidth="2">
              <path d="M12 22s7-7.4 7-13a7 7 0 1 0-14 0c0 5.6 7 13 7 13z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            IXP-1 · Xenoptics Matrix
          </div>
          <div className={styles.clock}>{clockStr || "Live Telemetry Clock"}</div>
          <div className={styles.avatar} title={`Current Session Role: ${userRole}`}>
            {userRole === "readonly" ? "V" : "A"}
          </div>
        </div>
      </header>

      {/* ====================================================================
          2. STICKY SUB-NAV (Exact horizontal jump links)
          ==================================================================== */}
      <nav className={styles.subnav}>
        <button
          type="button"
          className={`${styles.subnavItem} ${activeSection === "sec-overview" ? styles.subnavItemActive : ""}`}
          onClick={() => jumpTo("sec-overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`${styles.subnavItem} ${activeSection === "sec-topology" ? styles.subnavItemActive : ""}`}
          onClick={() => jumpTo("sec-topology")}
        >
          Topology
        </button>
        <button
          type="button"
          className={`${styles.subnavItem} ${activeSection === "sec-bod" ? styles.subnavItemActive : ""}`}
          onClick={() => jumpTo("sec-bod")}
        >
          BoD Orchestrator
        </button>
        <button
          type="button"
          className={`${styles.subnavItem} ${activeSection === "sec-analytics" ? styles.subnavItemActive : ""}`}
          onClick={() => jumpTo("sec-analytics")}
        >
          Analytics
        </button>
        <button
          type="button"
          className={`${styles.subnavItem} ${activeSection === "sec-faults" ? styles.subnavItemActive : ""}`}
          onClick={() => jumpTo("sec-faults")}
        >
          Fault &amp; Events
        </button>
        <button
          type="button"
          className={`${styles.subnavItem} ${activeSection === "sec-billing" ? styles.subnavItemActive : ""}`}
          onClick={() => jumpTo("sec-billing")}
        >
          CRM &amp; Billing
        </button>

        <div className={styles.subnavRightTools}>
          {onOpenRawBay && (
            <button type="button" className={styles.btnOutline} onClick={onOpenRawBay}>
              🎛️ Raw ODF Bay
            </button>
          )}
          {onOpenSettings && (
            <button type="button" className={styles.btnOutline} onClick={onOpenSettings}>
              ⚙️ Actuator HW
            </button>
          )}
          {onOpenLogs && (
            <button type="button" className={styles.btnOutline} onClick={onOpenLogs}>
              📜 Logs
            </button>
          )}
        </div>
      </nav>

      <main className={styles.contentArea}>
        {/* ====================================================================
            SECTION 1: 1· Global Overview
            ==================================================================== */}
        <section id="sec-overview" className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>1· Global Overview</span>
            <span className={styles.sectionSub}>Live health across the IXP fabric</span>
          </div>

          {/* 1. TOP KPI STRIP (5 CARDS) */}
          <div className={styles.kpiStrip}>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>IXP Peering Ports Active</div>
              <div className={styles.kpiValue}>
                {summary.connected_port}{" "}
                <span className={styles.kpiUnit}>/ {summary.total_ports}</span>
              </div>
              <div className={`${styles.kpiDelta} ${styles.deltaGood}`}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M4 15l6-6 4 4 6-8" />
                </svg>
                {((summary.connected_port / (summary.total_ports || 1)) * 100).toFixed(1)} % utilized
              </div>
            </div>

            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>Aggregate Exchange Throughput</div>
              <div className={styles.kpiValue}>
                {((summary.connected_port || 12) * 0.15 + 0.1).toFixed(2)} <span className={styles.kpiUnit}>Tbps</span>
              </div>
              <div className={`${styles.kpiDelta} ${styles.deltaGood}`}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M4 15l6-6 4 4 6-8" />
                </svg>
                +10.4% vs prior 24h
              </div>
            </div>

            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>Optical Fabric Availability</div>
              <div className={styles.kpiValue}>
                {systemStatus.status === "Ready" ? "99.985" : "98.540"}
                <span className={styles.kpiUnit}>%</span>
              </div>
              <div className={`${styles.kpiDelta} ${styles.deltaMuted}`}>Hardware: {systemStatus.status}</div>
            </div>

            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>Active Peering Sessions</div>
              <div className={styles.kpiValue}>{systemStatus.total_connection}</div>
              <div className={`${styles.kpiDelta} ${styles.deltaMuted}`}>
                {systemStatus.total_queue} queue pending
              </div>
            </div>

            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>Critical Alarms &amp; Notifications</div>
              <div
                className={styles.kpiValue}
                style={{ color: systemStatus.total_notification > 0 ? "#d03b3b" : "#0ca30c" }}
              >
                {systemStatus.total_notification}
              </div>
              <div
                className={`${styles.kpiDelta} ${systemStatus.total_notification > 0 ? styles.deltaCritical : styles.deltaGood}`}
                style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                title={systemStatus.total_notification > 0 ? `${systemStatus.total_notification} unacknowledged notifications` : "All systems nominal"}
              >
                {systemStatus.total_notification > 0 ? `${systemStatus.total_notification} unread hardware events` : "Nominal, no active fault"}
              </div>
            </div>
          </div>

          {/* 2. MIDDLE ROW: FACILITY & ACTIVE ROUTE + CRITICAL ALARMS */}
          <div className={styles.row}>
            {/* Facility & Active Route Overview */}
            <div className={`${styles.card} ${styles.col2}`}>
              <div className={styles.cardHead}>
                <div>
                  <div className={styles.cardTitle}>Facility &amp; Active Route Overview</div>
                  <div className={styles.cardSub}>Existing Data Center — live link status by segment</div>
                </div>
                <div className={styles.legend}>
                  <div className={styles.legendItem}>
                    <span className={styles.legendSwatch} style={{ background: "#0ca30c" }} />
                    Nominal
                  </div>
                  <div className={styles.legendItem}>
                    <span className={styles.legendSwatch} style={{ background: "#fab219" }} />
                    Degraded
                  </div>
                  <div className={styles.legendItem}>
                    <span className={styles.legendSwatch} style={{ background: "#d03b3b" }} />
                    Down
                  </div>
                </div>
              </div>
              <div className={styles.cardBody} style={{ display: "flex", flexDirection: "column", padding: "14px 16px" }}>
                {/* Floor Selection Quick Pills */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
                  {[
                    { id: "5th", label: "5th Floor (Zone B)" },
                    { id: "3rd-4th", label: "3rd–4th Floor (Expansion)" },
                    { id: "2nd", label: "2nd Floor (MMR-A)" },
                    { id: "1st", label: "1st Floor (Office/Carrier)" },
                    { id: "ground", label: "Ground Floor (MDF)" },
                  ].map((fl) => (
                    <button
                      key={fl.id}
                      type="button"
                      id={`pill-floor-${fl.id}`}
                      onClick={() => setSelectedFloorId(fl.id)}
                      style={{
                        padding: "4px 10px",
                        fontSize: "11px",
                        fontWeight: selectedFloorId === fl.id ? "700" : "500",
                        borderRadius: "4px",
                        border: selectedFloorId === fl.id ? "1.5px solid #8BC53E" : "1px solid #D1D5DB",
                        background: selectedFloorId === fl.id ? "#EAF3DC" : "#FFFFFF",
                        color: selectedFloorId === fl.id ? "#2D520D" : "#4B5563",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {fl.label}
                    </button>
                  ))}
                </div>

                <svg viewBox="0 0 620 280" style={{ width: "100%", height: "auto" }}>
                  {/* --- 5th Floor --- */}
                  <g
                    id="floor-band-5th"
                    className={styles.floorInteractive}
                    onClick={() => setSelectedFloorId("5th")}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x="20"
                      y="8"
                      width="580"
                      height="42"
                      rx="4"
                      fill={selectedFloorId === "5th" ? "#DCF1C5" : "#F7F8FA"}
                      stroke={selectedFloorId === "5th" ? "#8BC53E" : "#E2E6EB"}
                      strokeWidth={selectedFloorId === "5th" ? "2" : "1"}
                      style={{ cursor: "pointer", pointerEvents: "all" }}
                      onClick={() => setSelectedFloorId("5th")}
                    />
                    <text
                      x="30"
                      y="33"
                      fontSize="11"
                      fill={selectedFloorId === "5th" ? "#2D520D" : "#5C6B7A"}
                      fontWeight={selectedFloorId === "5th" ? "700" : "600"}
                      fontFamily="IBM Plex Sans, sans-serif"
                      style={{ pointerEvents: "none" }}
                    >
                      5th Floor — Data Hall (Zone B) · MMR-B
                    </text>
                    <text x="460" y="33" fontSize="9" fill={selectedFloorId === "5th" ? "#3E6B12" : "#8B98A5"} fontFamily="IBM Plex Sans, sans-serif" style={{ pointerEvents: "none" }}>
                      276 fibers · Secondary Fabric
                    </text>
                  </g>

                  {/* --- 3rd - 4th Floor --- */}
                  <g
                    id="floor-band-3rd-4th"
                    className={styles.floorInteractive}
                    onClick={() => setSelectedFloorId("3rd-4th")}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x="20"
                      y="56"
                      width="580"
                      height="42"
                      rx="4"
                      fill={selectedFloorId === "3rd-4th" ? "#EFF6FF" : "#FBFBFC"}
                      stroke={selectedFloorId === "3rd-4th" ? "#3B82F6" : "#E2E6EB"}
                      strokeWidth={selectedFloorId === "3rd-4th" ? "2" : "1"}
                      style={{ cursor: "pointer", pointerEvents: "all" }}
                      onClick={() => setSelectedFloorId("3rd-4th")}
                    />
                    <text
                      x="30"
                      y="81"
                      fontSize="11"
                      fill={selectedFloorId === "3rd-4th" ? "#1D4ED8" : "#94A3B8"}
                      fontWeight={selectedFloorId === "3rd-4th" ? "700" : "600"}
                      fontFamily="IBM Plex Sans, sans-serif"
                      style={{ pointerEvents: "none" }}
                    >
                      3rd — 4th Floor — Space for Future Expansion
                    </text>
                    <text x="475" y="81" fontSize="9" fill="#94A3B8" fontFamily="IBM Plex Sans, sans-serif" style={{ pointerEvents: "none" }}>
                      Reserved Riser Bays
                    </text>
                  </g>

                  {/* --- 2nd Floor (MMR-A) --- */}
                  <g
                    id="floor-band-2nd"
                    className={styles.floorInteractive}
                    onClick={() => setSelectedFloorId("2nd")}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x="20"
                      y="104"
                      width="580"
                      height="46"
                      rx="4"
                      fill={selectedFloorId === "2nd" ? "#EAF3DC" : "#F7F8FA"}
                      stroke={selectedFloorId === "2nd" ? "#8BC53E" : "#E2E6EB"}
                      strokeWidth={selectedFloorId === "2nd" ? "2" : "1"}
                      style={{ cursor: "pointer", pointerEvents: "all" }}
                      onClick={() => setSelectedFloorId("2nd")}
                    />
                    <text
                      x="30"
                      y="125"
                      fontSize="11"
                      fill={selectedFloorId === "2nd" ? "#2D520D" : "#5C6B7A"}
                      fontWeight="700"
                      fontFamily="IBM Plex Sans, sans-serif"
                      style={{ pointerEvents: "none" }}
                    >
                      2nd Floor — Data Hall (Zone A) — IXP Meet-Me-Room MMR-A
                    </text>
                    <text x="30" y="140" fontSize="9.5" fill={selectedFloorId === "2nd" ? "#4A6332" : "#8B98A5"} fontFamily="IBM Plex Sans, sans-serif" style={{ pointerEvents: "none" }}>
                      2× XSOS-576D robotic fabric — peering cross-connects
                    </text>
                    <text x="470" y="125" fontSize="9" fill={selectedFloorId === "2nd" ? "#2D520D" : "#5C6B7A"} fontFamily="IBM Plex Sans, sans-serif" style={{ pointerEvents: "none" }}>
                      MMR-A ⇄ MMR-B (24 fibers)
                    </text>
                  </g>

                  {/* --- 1st Floor --- */}
                  <g
                    id="floor-band-1st"
                    className={styles.floorInteractive}
                    onClick={() => setSelectedFloorId("1st")}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x="20"
                      y="156"
                      width="580"
                      height="42"
                      rx="4"
                      fill={selectedFloorId === "1st" ? "#F1F5F9" : "#F7F8FA"}
                      stroke={selectedFloorId === "1st" ? "#64748B" : "#E2E6EB"}
                      strokeWidth={selectedFloorId === "1st" ? "2" : "1"}
                      style={{ cursor: "pointer", pointerEvents: "all" }}
                      onClick={() => setSelectedFloorId("1st")}
                    />
                    <text
                      x="30"
                      y="181"
                      fontSize="11"
                      fill={selectedFloorId === "1st" ? "#0F172A" : "#5C6B7A"}
                      fontWeight={selectedFloorId === "1st" ? "700" : "600"}
                      fontFamily="IBM Plex Sans, sans-serif"
                      style={{ pointerEvents: "none" }}
                    >
                      1st Floor — Office A/B &amp; Carrier Interconnect
                    </text>
                    <text x="475" y="181" fontSize="9" fill={selectedFloorId === "1st" ? "#334155" : "#8B98A5"} fontFamily="IBM Plex Sans, sans-serif" style={{ pointerEvents: "none" }}>
                      48 fibers · Carrier Demarc
                    </text>
                  </g>

                  {/* --- Ground Floor (MDF) --- */}
                  <g
                    id="floor-band-ground"
                    className={styles.floorInteractive}
                    onClick={() => setSelectedFloorId("ground")}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x="20"
                      y="204"
                      width="580"
                      height="46"
                      rx="4"
                      fill={selectedFloorId === "ground" ? "#DCF1C5" : "#FBFBFC"}
                      stroke={selectedFloorId === "ground" ? "#8BC53E" : "#E2E6EB"}
                      strokeWidth={selectedFloorId === "ground" ? "2" : "1"}
                      style={{ cursor: "pointer", pointerEvents: "all" }}
                      onClick={() => setSelectedFloorId("ground")}
                    />
                    <text
                      x="30"
                      y="225"
                      fontSize="11"
                      fill={selectedFloorId === "ground" ? "#2D520D" : "#5C6B7A"}
                      fontWeight={selectedFloorId === "ground" ? "700" : "600"}
                      fontFamily="IBM Plex Sans, sans-serif"
                      style={{ pointerEvents: "none" }}
                    >
                      Ground Floor — Telecom-A/B Rooms · MDF-1/2/3
                    </text>
                    <text x="30" y="240" fontSize="9.5" fill={selectedFloorId === "ground" ? "#4A6332" : "#8B98A5"} fontFamily="IBM Plex Sans, sans-serif" style={{ pointerEvents: "none" }}>
                      288 inbound fibers · 3× XSOS-576D units
                    </text>
                    <text x="460" y="225" fontSize="9" fill={selectedFloorId === "ground" ? "#2D520D" : "#8B98A5"} fontFamily="IBM Plex Sans, sans-serif" style={{ pointerEvents: "none" }}>
                      Backbone Riser Feeds
                    </text>
                  </g>

                  {/* Footnote */}
                  <text x="30" y="268" fontSize="9.5" fill="#8B98A5" fontFamily="IBM Plex Sans, sans-serif">
                    💡 Klik salah satu baris lantai atau tombol di atas untuk melihat rincian spesifikasi perangkat dan kapasitas serat optik
                  </text>
                </svg>

                {/* Dynamic Facility Detail Panel for Selected Floor */}
                {(() => {
                  const activeFloor = facilityFloors.find((f) => f.id === selectedFloorId) || {
                    id: selectedFloorId,
                    name:
                      selectedFloorId === "5th"
                        ? "5th Floor — Data Hall (Zone B)"
                        : selectedFloorId === "3rd-4th"
                        ? "3rd — 4th Floor — Space for Future Expansion"
                        : selectedFloorId === "1st"
                        ? "1st Floor — Office A/B & Carrier Interconnect"
                        : selectedFloorId === "ground"
                        ? "Ground Floor — Telecom-A/B Rooms · MDF-1/2/3"
                        : "2nd Floor — Data Hall (Zone A)",
                    room:
                      selectedFloorId === "5th"
                        ? "Secondary Fabric MMR-B"
                        : selectedFloorId === "3rd-4th"
                        ? "Unallocated Expansion Floor"
                        : selectedFloorId === "1st"
                        ? "Carrier Demarcation & Meet-Point"
                        : selectedFloorId === "ground"
                        ? "MDF-1 / MDF-2 / MDF-3"
                        : "Primary IXP Meet-Me-Room (MMR-A)",
                    total_fibers:
                      selectedFloorId === "5th" ? 276 : selectedFloorId === "3rd-4th" ? 0 : selectedFloorId === "1st" ? 48 : selectedFloorId === "ground" ? 288 : 276,
                    xsos_units:
                      selectedFloorId === "5th"
                        ? "2× XSOS-576D robotic subracks"
                        : selectedFloorId === "3rd-4th"
                        ? "Unpopulated (Reserved Bays)"
                        : selectedFloorId === "1st"
                        ? "Optical Patch Panel Demarcation"
                        : selectedFloorId === "ground"
                        ? "3× XSOS-576D robotic subracks"
                        : "2× XSOS-576D robotic fabric",
                    role:
                      selectedFloorId === "5th"
                        ? "Secondary IXP Meet-Me-Room & Member Distribution"
                        : selectedFloorId === "3rd-4th"
                        ? "Future Expansion Reserve"
                        : selectedFloorId === "1st"
                        ? "Carrier Interconnect & Corporate Hand-off"
                        : selectedFloorId === "ground"
                        ? "Inbound Fiber Feeds (3× 96-core) & Backbone Riser"
                        : "Primary Peering Fabric & Active Route Cross-Connects",
                    status: selectedFloorId === "3rd-4th" ? "Standby" : "Nominal",
                    description:
                      selectedFloorId === "5th"
                        ? "Distribusi koneksi member cross-connect ke rack Data Hall Zone B (276 serat optik per MMR)."
                        : selectedFloorId === "3rd-4th"
                        ? "Kapasitas ekspansi masa depan untuk penambahan rack tenant & fabric robotic modular fase 2."
                        : selectedFloorId === "1st"
                        ? "Jalur interkoneksi carrier transit & hand-off konektivitas operasional gedung."
                        : selectedFloorId === "ground"
                        ? "Titik masuk kabel fiber optik utama bawah tanah (sub-duct) dan terminasi riser backbone ke seluruh MMR."
                        : "Peering cross-connects aktif untuk anggota IXP dan distribusi serat optik ke rack pelanggan (Zone A).",
                    active_circuits_count:
                      selectedFloorId === "5th" ? 8 : selectedFloorId === "3rd-4th" ? 0 : selectedFloorId === "1st" ? 2 : selectedFloorId === "ground" ? 18 : 14,
                    interconnect:
                      selectedFloorId === "ground"
                        ? "MDF1—MDF3: 192 fibers · 288 inbound"
                        : "MMR-A ⇄ MMR-B (24 fibers)",
                    racks:
                      selectedFloorId === "5th"
                        ? ["MMR-B / R20-01", "MMR-B / R21-04", "MMR-B / R22-10"]
                        : selectedFloorId === "3rd-4th"
                        ? ["Reserved R30-R45"]
                        : selectedFloorId === "1st"
                        ? ["DEMARC-01", "DEMARC-02"]
                        : selectedFloorId === "ground"
                        ? ["MDF-1 Riser", "MDF-2 Riser", "MDF-3 Riser"]
                        : ["MMR-A / R03-02", "MMR-A / R08-12", "MMR-A / R11-05", "MMR-A / R15-08"],
                  };

                  return (
                    <div className={styles.facilityDetailPanel}>
                      <div className={styles.facilityDetailHeader}>
                        <div className={styles.facilityDetailTitle}>
                          <span>🏢 {activeFloor.name}</span>
                          <span
                            className={styles.badge}
                            style={{
                              background:
                                activeFloor.status === "Nominal"
                                  ? "rgba(12, 163, 12, 0.12)"
                                  : activeFloor.status === "Standby"
                                  ? "rgba(100, 116, 139, 0.15)"
                                  : "rgba(250, 178, 25, 0.18)",
                              color:
                                activeFloor.status === "Nominal"
                                  ? "#0ca30c"
                                  : activeFloor.status === "Standby"
                                  ? "#64748b"
                                  : "#fab219",
                              fontSize: 10,
                              padding: "2px 8px",
                            }}
                          >
                            {activeFloor.status}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                          Room: <strong style={{ color: "#1e293b" }}>{activeFloor.room}</strong>
                        </div>
                      </div>

                      <div className={styles.facilityDetailDesc}>
                        {activeFloor.description}
                      </div>

                      <div className={styles.facilityDetailMeta}>
                        <div className={styles.facilityMetaItem}>
                          <span className={styles.facilityMetaLabel}>Robotic Hardware</span>
                          <span className={styles.facilityMetaValue}>{activeFloor.xsos_units}</span>
                        </div>
                        <div className={styles.facilityMetaItem}>
                          <span className={styles.facilityMetaLabel}>Fiber Capacity</span>
                          <span className={styles.facilityMetaValue}>
                            {activeFloor.total_fibers > 0 ? `${activeFloor.total_fibers} Fibers` : "Reserved / Standby"}
                          </span>
                        </div>
                        <div className={styles.facilityMetaItem}>
                          <span className={styles.facilityMetaLabel}>Active Circuits</span>
                          <span className={styles.facilityMetaValue}>
                            {activeFloor.active_circuits_count > 0 ? `${activeFloor.active_circuits_count} Circuits` : "—"}
                          </span>
                        </div>
                        <div className={styles.facilityMetaItem}>
                          <span className={styles.facilityMetaLabel}>Segment Role</span>
                          <span className={styles.facilityMetaValue}>{activeFloor.role}</span>
                        </div>
                      </div>

                      {activeFloor.racks && activeFloor.racks.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                          <span className={styles.facilityMetaLabel} style={{ minWidth: "90px" }}>Assigned Racks:</span>
                          <div className={styles.facilityRacksWrap}>
                            {activeFloor.racks.map((rack) => (
                              <span key={rack} className={styles.facilityRackChip}>
                                {rack}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Critical Alarms Card */}
            <div className={`${styles.card} ${styles.col1}`} style={{ minWidth: "340px" }}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>Critical Alarms &amp; Incidents</div>
                <span className={`${styles.badge} ${systemStatus.total_notification > 0 || liveIncidents.length > 0 ? styles.badgeCritical : styles.badgeNormal}`}>
                  <span className={styles.badgeDot} style={{ background: systemStatus.total_notification > 0 || liveIncidents.length > 0 ? "#c22f2f" : "#0ca30c" }} />
                  {systemStatus.total_notification > 0
                    ? `${systemStatus.total_notification} HW Alerts`
                    : liveIncidents.length > 0
                    ? `${liveIncidents.length} Incidents`
                    : "Nominal"}
                </span>
              </div>
              <div className={styles.cardBody} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Donut Chart with Legend */}
                {(() => {
                  const critCount = liveIncidents.filter((i) => i.severity === "Critical").length || (systemStatus.total_notification > 0 ? 2 : 0);
                  const warnCount = liveIncidents.filter((i) => i.severity === "Warning").length || (systemStatus.total_notification > 0 ? 3 : 0);
                  const total = Math.max(1, critCount + warnCount + (liveIncidents.length > 0 ? 1 : 0));
                  const critPct = (critCount / total) * 100;
                  const warnPct = ((critCount + warnCount) / total) * 100;
                  const alarmGradient = `conic-gradient(#d03b3b 0% ${critPct}%, #fab219 ${critPct}% ${warnPct}%, #AAB4BD ${warnPct}% 100%)`;

                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div className={styles.donutWrap}>
                        <div
                          className={styles.donut}
                          style={{ background: alarmGradient }}
                        />
                        <div className={styles.donutHole} />
                        <div className={styles.donutCenter}>
                          <div className={styles.donutN}>{systemStatus.total_notification || liveIncidents.length || 0}</div>
                          <div className={styles.donutL}>TOTAL</div>
                        </div>
                      </div>
                      <div className={styles.legend} style={{ flexDirection: "column", alignItems: "flex-start", gap: "6px" }}>
                        <div className={styles.legendItem}>
                          <span className={styles.legendSwatch} style={{ background: "#d03b3b" }} />
                          Critical · {critCount}
                        </div>
                        <div className={styles.legendItem}>
                          <span className={styles.legendSwatch} style={{ background: "#fab219" }} />
                          Warning · {warnCount}
                        </div>
                        <div className={styles.legendItem}>
                          <span className={styles.legendSwatch} style={{ background: "#AAB4BD" }} />
                          Info · {Math.max(0, (liveIncidents.length || 0) - critCount - warnCount)}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Alarm Row Items: show real incidents if present, else standard telemetry */}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {liveIncidents.length > 0 ? (
                    liveIncidents.slice(0, 5).map((inc) => (
                      <div key={inc.id} className={styles.alarmRow}>
                        <div
                          className={styles.alarmDot}
                          style={{ background: inc.severity === "Critical" ? "#d03b3b" : "#fab219" }}
                        />
                        <div>
                          <div className={styles.alarmMsg}>
                            {inc.root_cause || `Outage event on ${inc.circuit_id}`}
                          </div>
                          <div className={styles.alarmMeta}>
                            Circuit {inc.circuit_id} · {inc.severity} · {inc.resolved_at ? "Resolved" : "Active Outage"}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className={styles.alarmRow}>
                        <div className={styles.alarmDot} style={{ background: "#d03b3b" }} />
                        <div>
                          <div className={styles.alarmMsg}>Optical LOS — XSOS-576D-MMRA-01, Port 302</div>
                          <div className={styles.alarmMeta}>Active · MMR-A, Zone A</div>
                        </div>
                      </div>
                      <div className={styles.alarmRow}>
                        <div className={styles.alarmDot} style={{ background: "#fab219" }} />
                        <div>
                          <div className={styles.alarmMsg}>NetConf control-plane message delay</div>
                          <div className={styles.alarmMeta}>Active · SDN Controller</div>
                        </div>
                      </div>
                      <div className={styles.alarmRow}>
                        <div className={styles.alarmDot} style={{ background: "#fab219" }} />
                        <div>
                          <div className={styles.alarmMsg}>XSOS Matrix Latency above threshold, Rack R09</div>
                          <div className={styles.alarmMeta}>Active · MMR-A</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. BOTTOM ROW: 24h THROUGHPUT CHART + PORT SUMMARY */}
          <div className={styles.row} style={{ height: "196px" }}>
            {/* Aggregate Exchange Throughput — 24h */}
            <div className={`${styles.card} ${styles.col2}`}>
              <div className={styles.cardHead}>
                <div>
                  <div className={styles.cardTitle}>Aggregate Exchange Throughput — 24h</div>
                  <div className={styles.cardSub}>100G / 400G peering circuits, all members</div>
                </div>
                <div className={styles.legend}>
                  <div className={styles.legendItem}>
                    <span className={styles.legendSwatch} style={{ background: "#2a78d6" }} />
                    Throughput
                  </div>
                  <div className={styles.legendItem}>
                    <span className={styles.legendSwatch} style={{ background: "#C7CFD7" }} />
                    Provisioned capacity (2.0 Tbps)
                  </div>
                </div>
              </div>
              <div className={styles.cardBody} style={{ padding: "10px 16px" }}>
                <svg viewBox="0 0 700 130" style={{ width: "100%", height: "112px" }}>
                  <defs>
                    <linearGradient id="optAThruGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2a78d6" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#2a78d6" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <line x1="20" y1="10" x2="680" y2="10" stroke="#C7CFD7" strokeWidth="1.2" strokeDasharray="4 3" />
                  <text x="684" y="13" fontSize="9" fill="#8B98A5" fontFamily="var(--font-mono, monospace)">
                    2.0T
                  </text>
                  <g transform="translate(20,10)">
                    <path
                      d="M0.0,59.5 L28.7,61.5 L57.4,63.2 L86.1,64.8 L114.8,65.2 L143.5,63.6 L172.2,58.0 L200.9,49.5 L229.6,38.0 L258.3,29.2 L287.0,23.2 L315.7,20.2 L344.3,18.8 L373.0,19.8 L401.7,20.8 L430.4,22.2 L459.1,18.8 L487.8,15.8 L516.5,18.2 L545.2,25.2 L573.9,34.2 L602.6,43.2 L631.3,51.2 L660.0,57.2 L660.0,110 L0.0,110 Z"
                      fill="url(#optAThruGrad)"
                    />
                    <path
                      d="M0.0,59.5 L28.7,61.5 L57.4,63.2 L86.1,64.8 L114.8,65.2 L143.5,63.6 L172.2,58.0 L200.9,49.5 L229.6,38.0 L258.3,29.2 L287.0,23.2 L315.7,20.2 L344.3,18.8 L373.0,19.8 L401.7,20.8 L430.4,22.2 L459.1,18.8 L487.8,15.8 L516.5,18.2 L545.2,25.2 L573.9,34.2 L602.6,43.2 L631.3,51.2 L660.0,57.2"
                      fill="none"
                      stroke="#2a78d6"
                      strokeWidth="2"
                    />
                    <circle cx="487.8" cy="15.8" r="3.4" fill="#ffffff" stroke="#2a78d6" strokeWidth="2" />
                    <text
                      x="487.8"
                      y="8"
                      fontSize="9"
                      fill="#14212E"
                      fontWeight="700"
                      fontFamily="var(--font-mono, monospace)"
                      textAnchor="middle"
                    >
                      1.89T
                    </text>
                  </g>
                  <text x="20" y="126" fontSize="9" fill="#8B98A5" fontFamily="var(--font-mono, monospace)">
                    00:00
                  </text>
                  <text x="325" y="126" fontSize="9" fill="#8B98A5" fontFamily="var(--font-mono, monospace)" textAnchor="middle">
                    12:00
                  </text>
                  <text x="675" y="126" fontSize="9" fill="#8B98A5" fontFamily="var(--font-mono, monospace)" textAnchor="end">
                    23:00
                  </text>
                </svg>
              </div>
            </div>

            {/* Optical Fabric Port Summary */}
            <div className={`${styles.card} ${styles.col1}`} style={{ minWidth: "340px" }}>
              <div className={styles.cardHead}>
                <div>
                  <div className={styles.cardTitle}>Optical Fabric Port Summary</div>
                  <div className={styles.cardSub}>IXP peering fabric · MMR-A + MMR-B</div>
                </div>
              </div>
              <div className={styles.cardBody} style={{ display: "flex", alignItems: "center", gap: "18px", padding: "14px 16px" }}>
                {(() => {
                  const totalP = summary.total_ports || 1;
                  const connPct = Math.min(100, (summary.connected_port / totalP) * 100);
                  const availPct = Math.min(100, (summary.available_ports / totalP) * 100);
                  const donutGradient = `conic-gradient(#0ca30c 0% ${connPct.toFixed(1)}%, #2a78d6 ${connPct.toFixed(1)}% ${(connPct + availPct).toFixed(1)}%, #C7CFD7 ${(connPct + availPct).toFixed(1)}% 100%)`;
                  return (
                    <div className={styles.donutWrap}>
                      <div
                        className={styles.donut}
                        style={{
                          background: donutGradient,
                        }}
                      />
                      <div className={styles.donutHole} />
                      <div className={styles.donutCenter}>
                        <div className={styles.donutN}>{summary.total_ports}</div>
                        <div className={styles.donutL}>PORTS</div>
                      </div>
                    </div>
                  );
                })()}
                <div className={styles.legend} style={{ flexDirection: "column", alignItems: "flex-start", gap: "7px" }}>
                  <div className={styles.legendItem}>
                    <span className={styles.legendSwatch} style={{ background: "#0ca30c" }} />
                    Connected · {summary.connected_port}
                  </div>
                  <div className={styles.legendItem}>
                    <span className={styles.legendSwatch} style={{ background: "#2a78d6" }} />
                    Available · {summary.available_ports}
                  </div>
                  <div className={styles.legendItem}>
                    <span className={styles.legendSwatch} style={{ background: "#C7CFD7" }} />
                    Disabled · {summary.disabled_port + (summary.interconnection_port || 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ====================================================================
            SECTION 2: 2· Network Topology
            ==================================================================== */}
        <section id="sec-topology" className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>2· Network Topology</span>
            <span className={styles.sectionSub}>Existing Data Center cabling plan &amp; XSOS cross-connect matrix</span>
          </div>

          <NetworkTopologyView
            ports={ports}
            onOpenConnect={onOpenConnectModal}
          />
        </section>

        {/* ====================================================================
            SECTION 3: 3· Bandwidth on Demand Orchestrator
            ==================================================================== */}
        <section id="sec-bod" className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>3· Bandwidth on Demand Orchestrator</span>
            <span className={styles.sectionSub}>Cross-connect request &amp; provisioning workflow</span>
          </div>

          <BodOrchestratorView
            onDispatchConnect={onDispatchConnect}
          />
        </section>

        {/* ====================================================================
            SECTION 4: 4· Performance & Telemetry Analytics
            ==================================================================== */}
        <section id="sec-analytics" className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>4· Performance &amp; Telemetry Analytics</span>
            <span className={styles.sectionSub}>Rolling SLA compliance &amp; predictive signals</span>
          </div>

          <SlaAnalyticsView />
        </section>

        {/* ====================================================================
            SECTION 5: 5· Fault & Event Management
            ==================================================================== */}
        <section id="sec-faults" className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>5· Fault &amp; Event Management</span>
            <span className={styles.sectionSub}>Event log, root cause correlation &amp; maintenance ticket queue</span>
          </div>

          <FaultsEventsView />
        </section>

        {/* ====================================================================
            SECTION 6: 6· CRM & Metered Billing Management
            (Fulfills user requirement: "CRM nya sampe hitungan Billing")
            ==================================================================== */}
        <section id="sec-billing" className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>6· CRM &amp; Metered Billing Management</span>
            <span className={styles.sectionSub}>Member tenant directory, dynamic rating &amp; SLA outage compensation invoices</span>
          </div>

          <CrmBillingView />
        </section>

        <div className={styles.footerCap}>
          Option A · Single-Page Scroll — all workflows on one continuous page, sub-nav jumps between sections
        </div>
      </main>
    </div>
  );
}
