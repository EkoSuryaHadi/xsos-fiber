"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./NmsDashboard.module.css";
import { buildMockState, PANELS, PORTS_PER_PANEL } from "@/lib/mock-nms-data";
import ConnectModal from "./ConnectModal";
import DisconnectModal from "./DisconnectModal";
import LoggingView from "./LoggingView";
import SettingView from "./SettingView";
import SafetyBanner from "./SafetyBanner";
import GlobalDashboardView from "./GlobalDashboardView";
import NetworkTopologyView from "./NetworkTopologyView";
import BodOrchestratorView from "./BodOrchestratorView";
import SlaAnalyticsView from "./SlaAnalyticsView";
import FaultsEventsView from "./FaultsEventsView";
import CrmBillingView from "./CrmBillingView";
import OptionASinglePageView from "./OptionASinglePageView";
import lifecycleStyles from "./LifecycleViews.module.css";
import { evaluateRoboticSafety, type SafetyAssessment, type RoboticState } from "@/lib/safety";
import type {
  ConnectionItem,
  InventoryItem,
  Port,
  PortsSummary,
  QueueItem,
  SystemStatus,
} from "@/types/nms";

export type ActiveTabKey =
  | "global"
  | "topology"
  | "bod"
  | "sla"
  | "faults"
  | "billing"
  | "monitoring"
  | "setting"
  | "logging";

export default function NmsDashboard() {
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [layoutMode, setLayoutMode] = useState<"scroll" | "tabbed">("scroll");
  const [activeTab, setActiveTab] = useState<ActiveTabKey>("global");
  const [activeScrollSection, setActiveScrollSection] = useState<string>("sec-overview");

  const scrollToSection = (sectionId: string) => {
    setActiveScrollSection(sectionId);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    status: "Ready",
    total_queue: 0,
    total_connection: 0,
    total_notification: 0,
  });
  const [summary, setSummary] = useState<PortsSummary>({
    total_ports: 576,
    available_ports: 550,
    connected_port: 26,
    interconnection_port: 0,
    disabled_port: 0,
  });
  const [ports, setPorts] = useState<Record<string, Port>>({});
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Available" | "Connected" | "Disabled" | "Interconnection" | "Customer">("all");
  const [selectedChassis, setSelectedChassis] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);

  // User Mode / Role: "operator" (full control) vs "readonly" (audit viewer)
  const [userRole, setUserRole] = useState<"operator" | "readonly">("operator");

  // Modal states
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [connectInitialSource, setConnectInitialSource] = useState<{ panel: string; port: number } | null>(null);
  const [disconnectPort, setDisconnectPort] = useState<Port | null>(null);
  const [disconnectConnection, setDisconnectConnection] = useState<ConnectionItem | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Safety and Simulation states
  const [simulatedState, setSimulatedState] = useState<{
    state: RoboticState;
    customMsg?: string;
    progress?: string | null;
  } | null>(null);

  // Show toast notification
  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const applyMock = () => {
    const mock = buildMockState();
    setMode("demo");
    setSystemStatus(mock.systemStatus);
    setSummary(mock.summary);
    setPorts(mock.ports);
    setConnections(mock.connections);
    setQueue(mock.queue);
    setInventory(mock.inventory);
    setLastSyncAt(new Date().toISOString());
  };

  // Evaluate robotic safety interlocks
  const safety: SafetyAssessment = useMemo(() => {
    if (simulatedState) {
      const stateLabels: Record<RoboticState, string> = {
        ready: "ACTUATOR ARMED & READY",
        operating: "ACTUATOR IN-MOTION",
        locked: "SAFETY INTERLOCK (LOCKED)",
        locking: "SAFETY INTERLOCK (LOCKING)",
        unlocking: "SAFETY INTERLOCK (UNLOCKING)",
        initializing: "CALIBRATING ACTUATOR",
        recovery: "FAULT RECOVERY ACTIVE",
        paused: "SYSTEM PAUSED",
        standby: "STANDBY / POWER SAVER",
        alarm: "CRITICAL HARDWARE ALARM",
      };
      const isSafe = simulatedState.state === "ready";
      const progressPercent = simulatedState.progress
        ? parseInt(simulatedState.progress, 10)
        : simulatedState.state === "operating"
        ? 65
        : null;

      return {
        isSafe,
        state: simulatedState.state,
        stateLabel: stateLabels[simulatedState.state] || "UNKNOWN",
        activeAlarms:
          simulatedState.state === "alarm"
            ? [simulatedState.customMsg || "ALARM-03: S-Axis Motor Current Spike Exceeded Threshold"]
            : [],
        interlockReason: isSafe ? null : (simulatedState.customMsg || "Simulated safety interlock engaged"),
        progressPercent,
        unitStatuses: inventory.map((i) => ({
          name: i.name,
          serialNo: i.serial_no,
          status: isSafe ? "Ready" : simulatedState.state,
          progress: simulatedState.progress || null,
          alarm: simulatedState.state === "alarm" ? (simulatedState.customMsg || "Alarm") : null,
        })),
      };
    }
    return evaluateRoboticSafety(systemStatus, inventory);
  }, [systemStatus, inventory, simulatedState]);

  const loadLive = async () => {
    try {
      const [sysRes, sumRes, portsRes, connRes, queueRes, invRes] = await Promise.all([
        fetch("/api/nms/system-status"),
        fetch("/api/nms/ports/summary"),
        fetch("/api/nms/ports"),
        fetch("/api/nms/connections"),
        fetch("/api/nms/queue"),
        fetch("/api/nms/inventory").catch(() => null),
      ]);

      if (!sysRes.ok || !sumRes.ok || !portsRes.ok) {
        throw new Error("Proxy error");
      }

      const sys = await sysRes.json();
      const sum = await sumRes.json();
      const portsRaw = await portsRes.json();
      const portList: Port[] = Array.isArray(portsRaw)
        ? portsRaw
        : Array.isArray(portsRaw?.items)
        ? portsRaw.items
        : [];

      const connsRaw = connRes.ok ? await connRes.json() : [];
      const conns: ConnectionItem[] = Array.isArray(connsRaw)
        ? connsRaw
        : Array.isArray(connsRaw?.items)
        ? connsRaw.items
        : [];

      const qRaw = queueRes.ok ? await queueRes.json() : [];
      const q: QueueItem[] = Array.isArray(qRaw)
        ? qRaw
        : Array.isArray(qRaw?.items)
        ? qRaw.items
        : [];

      const invRaw = invRes && invRes.ok ? await invRes.json() : [];
      const inv: InventoryItem[] = Array.isArray(invRaw)
        ? invRaw
        : Array.isArray(invRaw?.items)
        ? invRaw.items
        : [];

      const map: Record<string, Port> = {};
      for (const p of portList) {
        map[`${p.panel_name}#${p.port_no}`] = p;
      }

      setMode("live");
      setSystemStatus(sys);
      setSummary(sum);
      setPorts(map);
      setConnections(conns);
      setQueue(q);
      if (inv.length > 0) setInventory(inv);
      setLastSyncAt(new Date().toISOString());
    } catch {
      applyMock();
    }
  };

  useEffect(() => {
    // Initial fetch to load complete port matrix and inventory
    loadLive();

    // Option B: Real-Time Server-Sent Events (SSE) Push Stream
    let es: EventSource | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    try {
      es = new EventSource("/api/nms/stream");

      es.onopen = () => {
        setIsStreaming(true);
        setMode("live");
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "telemetry") {
            if (data.summary) setSummary(data.summary);
            if (data.systemStatus) setSystemStatus(data.systemStatus);
            if (data.connections && Array.isArray(data.connections.items)) {
              setConnections(data.connections.items);
            }
            if (data.queue && Array.isArray(data.queue.items)) {
              setQueue(data.queue.items);
            }
            setMode("live");
            setIsStreaming(true);
            setLastSyncAt(data.timestamp || new Date().toISOString());
          }
        } catch (err) {
          console.warn("SSE telemetry parse error", err);
        }
      };

      es.onerror = () => {
        setIsStreaming(false);
      };
    } catch {
      setIsStreaming(false);
    }

    // Secondary fallback heartbeat polling (every 12s)
    fallbackInterval = setInterval(loadLive, 12000);

    return () => {
      es?.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, []);

  // Auto-synchronize active section on scroll in Option A (Single-Page Scroll)
  useEffect(() => {
    if (layoutMode !== "scroll") return;
    const sectionIds = ["sec-overview", "sec-topology", "sec-bod", "sec-analytics", "sec-faults", "sec-billing"];
    const handleScroll = () => {
      const scrollY = window.scrollY + 140;
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollY >= top && scrollY < top + height) {
            setActiveScrollSection(id);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [layoutMode]);

  // Hotkey navigation: ALT+1 s/d ALT+6 (supports both Option A Single-Page Scroll and Tabbed)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (layoutMode === "scroll") {
        if (e.altKey && e.key === "1") scrollToSection("sec-overview");
        if (e.altKey && e.key === "2") scrollToSection("sec-topology");
        if (e.altKey && e.key === "3") scrollToSection("sec-bod");
        if (e.altKey && e.key === "4") scrollToSection("sec-analytics");
        if (e.altKey && e.key === "5") scrollToSection("sec-faults");
        if (e.altKey && e.key === "6") scrollToSection("sec-billing");
      } else {
        if (e.altKey && e.key === "1") setActiveTab("global");
        if (e.altKey && e.key === "2") setActiveTab("topology");
        if (e.altKey && e.key === "3") setActiveTab("bod");
        if (e.altKey && e.key === "4") setActiveTab("sla");
        if (e.altKey && e.key === "5") setActiveTab("faults");
        if (e.altKey && e.key === "6") setActiveTab("billing");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [layoutMode]);

  const panels = useMemo(() => {
    const set = new Set<string>();
    Object.values(ports).forEach((p) => {
      if (p.panel_name) set.add(p.panel_name);
    });
    return set.size > 0 ? Array.from(set).sort() : Array.from(PANELS);
  }, [ports]);

  const portsByPanel = useMemo(() => {
    const res: Record<string, Port[]> = {};
    for (const panel of panels) {
      res[panel] = [];
    }
    for (const p of Object.values(ports)) {
      if (res[p.panel_name]) {
        res[p.panel_name].push(p);
      }
    }
    for (const panel of panels) {
      if (res[panel]) {
        res[panel].sort((a, b) => a.port_no - b.port_no);
      }
    }
    return res;
  }, [panels, ports]);

  const displayedPanels = useMemo(() => {
    if (selectedChassis === "all") return panels;
    return panels.filter((p) => p === selectedChassis);
  }, [panels, selectedChassis]);

  const customerAllocatedCount = useMemo(() => {
    return Object.values(ports).filter((p) => p.allocated_to_customer != null).length;
  }, [ports]);

  const matches = (p: Port) => {
    if (selectedChassis !== "all" && p.panel_name !== selectedChassis) return false;
    if (statusFilter === "Interconnection") {
      if (!p.reserved_as_interconnection) return false;
    } else if (statusFilter === "Customer") {
      if (!p.allocated_to_customer) return false;
    } else if (statusFilter !== "all" && p.status !== statusFilter) {
      return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.description.toLowerCase().includes(q) ||
      p.panel_name.toLowerCase().includes(q) ||
      String(p.port_no).includes(q) ||
      (p.connected_port != null && String(p.connected_port).includes(q)) ||
      (p.allocated_to_customer != null && p.allocated_to_customer.toLowerCase().includes(q))
    );
  };

  const selectedPort = selected ? ports[selected] : null;

  const filteredConnections = useMemo(() => {
    if (!search) return connections;
    const q = search.toLowerCase();
    return connections.filter((c) => {
      const src = c.source[0]?.port_description?.toLowerCase() || "";
      const tgt = c.target[0]?.port_description?.toLowerCase() || "";
      const user = c.created_by ? c.created_by.toLowerCase() : "";
      return src.includes(q) || tgt.includes(q) || user.includes(q);
    });
  }, [connections, search]);

  const handleLogout = async () => {
    if (!window.confirm("Apakah Anda yakin ingin logout dari sesi NMS Xenoptics XSOS?")) {
      return;
    }
    try {
      await fetch("/api/nms/auth/logout", { method: "POST" });
    } catch {}
    setUserRole("readonly");
    showToast("Sesi NMS XSOS di-terminate secara aman (DELETE /authentication/logout). Beralih ke Audit Viewer (Read-Only).", "success");
  };

  const handleConnect = async (params: {
    source_panel_name: string;
    source_port_no: number[];
    target_panel_name: string;
    target_port_no: number[];
    route?: number;
    start_date?: string;
    customer?: string;
  }) => {
    if (userRole === "readonly") {
      showToast("Aksi diblokir: Sesi berada dalam mode Audit Viewer (Read-Only).", "error");
      return;
    }

    try {
      const res = await fetch("/api/nms/control/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Gagal menghubungkan port." }));
        throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err));
      }
    } catch (apiErr: unknown) {
      if (mode !== "demo") {
        throw apiErr;
      }
    }

    // Optimistic batch updates for all connected pairs
    setPorts((prev) => {
      const updated = { ...prev };
      for (let i = 0; i < params.source_port_no.length; i++) {
        const sNo = params.source_port_no[i];
        const tNo = params.target_port_no[i];
        const sKey = `${params.source_panel_name}#${sNo}`;
        const tKey = `${params.target_panel_name}#${tNo}`;

        if (updated[sKey]) {
          updated[sKey] = {
            ...updated[sKey],
            status: "Connected",
            connected_port: tNo,
            connected_count: (updated[sKey].connected_count || 0) + 1,
            allocated_to_customer: params.customer || updated[sKey].allocated_to_customer,
          };
        }
        if (updated[tKey]) {
          updated[tKey] = {
            ...updated[tKey],
            status: "Connected",
            connected_port: sNo,
            connected_count: (updated[tKey].connected_count || 0) + 1,
            allocated_to_customer: params.customer || updated[tKey].allocated_to_customer,
          };
        }
      }
      return updated;
    });

    // Add new connection records to list
    setConnections((prev) => {
      const newConns = [...prev];
      for (let i = 0; i < params.source_port_no.length; i++) {
        const sNo = params.source_port_no[i];
        const tNo = params.target_port_no[i];
        newConns.unshift({
          no: newConns.length + 1,
          connection_id: Date.now() + i,
          operation_name: "Connect",
          created_by: params.customer ? `${params.customer} (Robotic)` : "NOC-OPERATOR",
          created_at: new Date().toISOString().replace("T", " ").slice(0, 19),
          source: [
            {
              panel_name: params.source_panel_name,
              port_no: sNo,
              port_description: `${params.source_panel_name}-P${sNo}`,
            },
          ],
          target: [
            {
              panel_name: params.target_panel_name,
              port_no: tNo,
              port_description: `${params.target_panel_name}-P${tNo}`,
            },
          ],
        });
      }
      return newConns;
    });

    // Update summary counters
    setSummary((prev) => {
      const pairCount = params.source_port_no.length;
      const count = pairCount * 2;
      return {
        ...prev,
        available_ports: Math.max(0, prev.available_ports - count),
        connected_port: prev.connected_port + count,
      };
    });

    const count = params.source_port_no.length;
    if (count > 1) {
      showToast(
        `Instruksi sambung batch ${count} port (${params.source_panel_name} P-${params.source_port_no[0]}..${params.source_port_no[count - 1]} ──▶ ${params.target_panel_name} P-${params.target_port_no[0]}..${params.target_port_no[count - 1]}) berhasil diajukan!`,
        "success"
      );
    } else {
      showToast(
        `Instruksi sambung port P-${params.source_port_no[0]} → P-${params.target_port_no[0]} berhasil diajukan.`,
        "success"
      );
    }
  };

  const handleDisconnect = async (panelName: string, portNo: number) => {
    if (userRole === "readonly") {
      showToast("Aksi diblokir: Sesi berada dalam mode Audit Viewer (Read-Only).", "error");
      return;
    }

    try {
      const res = await fetch("/api/nms/control/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          panel_name: panelName,
          port_no: portNo,
          confirm_interlock: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Gagal memutus koneksi." }));
        throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err));
      }
    } catch (apiErr: unknown) {
      if (mode !== "demo") {
        throw apiErr;
      }
    }

    // Optimistically free local port and its remote partner
    let remotePortFound: number | null = null;
    setPorts((prev) => {
      const updated = { ...prev };
      const targetKey = `${panelName}#${portNo}`;
      const portObj = updated[targetKey];
      if (portObj) {
        remotePortFound = portObj.connected_port;
        updated[targetKey] = {
          ...portObj,
          status: "Available",
          connected_port: null,
        };
        if (remotePortFound != null) {
          for (const key of Object.keys(updated)) {
            if (updated[key].connected_port === portNo) {
              updated[key] = {
                ...updated[key],
                status: "Available",
                connected_port: null,
              };
            }
          }
        }
      }
      return updated;
    });

    setConnections((prev) =>
      prev.filter(
        (c) =>
          !(
            (c.source[0]?.panel_name === panelName && c.source[0]?.port_no === portNo) ||
            (c.target[0]?.panel_name === panelName && c.target[0]?.port_no === portNo)
          )
      )
    );

    setSummary((prev) => ({
      ...prev,
      available_ports: Math.min(prev.total_ports, prev.available_ports + 2),
      connected_port: Math.max(0, prev.connected_port - 2),
    }));

    showToast(`Koneksi pada ${panelName} P-${portNo} berhasil diputus.`, "success");
  };

  const handleDisconnectById = async (connectionId: number) => {
    if (userRole === "readonly") {
      showToast("Aksi diblokir: Sesi berada dalam mode Audit Viewer (Read-Only).", "error");
      return;
    }

    try {
      const res = await fetch(`/api/nms/control/disconnect/${connectionId}?confirm_interlock=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm_interlock: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Gagal memutus koneksi." }));
        throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err));
      }
    } catch (apiErr: unknown) {
      if (mode !== "demo") {
        throw apiErr;
      }
    }

    // Optimistically update local ports and connections
    const conn = connections.find((c) => c.connection_id === connectionId);
    if (conn) {
      const srcPanel = conn.source[0]?.panel_name;
      const srcPort = conn.source[0]?.port_no;
      const tgtPanel = conn.target[0]?.panel_name;
      const tgtPort = conn.target[0]?.port_no;

      setPorts((prev) => {
        const updated = { ...prev };
        if (srcPanel && srcPort != null) {
          const k = `${srcPanel}#${srcPort}`;
          if (updated[k]) {
            updated[k] = { ...updated[k], status: "Available", connected_port: null };
          }
        }
        if (tgtPanel && tgtPort != null) {
          const k = `${tgtPanel}#${tgtPort}`;
          if (updated[k]) {
            updated[k] = { ...updated[k], status: "Available", connected_port: null };
          }
        }
        return updated;
      });
    }

    setConnections((prev) => prev.filter((c) => c.connection_id !== connectionId));
    setSummary((prev) => ({
      ...prev,
      available_ports: Math.min(prev.total_ports, prev.available_ports + 2),
      connected_port: Math.max(0, prev.connected_port - 2),
    }));

    showToast(`Sirkuit koneksi #${connectionId} berhasil diputus via API 2.3.`, "success");
  };

  const secondsAgo = lastSyncAt
    ? Math.max(0, Math.floor((Date.now() - new Date(lastSyncAt).getTime()) / 1000))
    : 0;

  if (layoutMode === "scroll") {
    return (
      <>
        <OptionASinglePageView
          summary={summary}
          systemStatus={systemStatus}
          ports={ports}
          mode={mode}
          isStreaming={isStreaming}
          onRefresh={loadLive}
          lastSyncAt={lastSyncAt}
          userRole={userRole}
          onDispatchConnect={handleConnect}
          onOpenConnectModal={() => {
            setConnectInitialSource(null);
            setIsConnectOpen(true);
          }}
          onOpenRawBay={() => {
            setLayoutMode("tabbed");
            setActiveTab("monitoring");
          }}
          onOpenSettings={() => {
            setLayoutMode("tabbed");
            setActiveTab("setting");
          }}
          onOpenLogs={() => {
            setLayoutMode("tabbed");
            setActiveTab("logging");
          }}
        />

        {/* Connect Modal */}
        <ConnectModal
          isOpen={isConnectOpen}
          onClose={() => setIsConnectOpen(false)}
          ports={ports}
          panels={panels}
          initialSource={connectInitialSource}
          safety={safety}
          readOnly={userRole === "readonly"}
          onConnect={handleConnect}
        />

        {/* Disconnect Modal */}
        {disconnectPort && (
          <DisconnectModal
            isOpen={true}
            onClose={() => setDisconnectPort(null)}
            port={disconnectPort}
            safety={safety}
            readOnly={userRole === "readonly"}
            onDisconnect={handleDisconnect}
          />
        )}
        {disconnectConnection && (
          <DisconnectModal
            isOpen={true}
            onClose={() => setDisconnectConnection(null)}
            connection={disconnectConnection}
            safety={safety}
            readOnly={userRole === "readonly"}
            onDisconnectById={handleDisconnectById}
          />
        )}
      </>
    );
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.shell}>
        {/* 1. Hardware Chassis Header & NOC Telemetry */}
        <div className={styles.topbar}>
          <div className={styles.brand}>
            <div className={styles.chassisIconBox}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
                <line x1="6" y1="9" x2="6.01" y2="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="10" y1="9" x2="10.01" y2="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="14" y1="9" x2="14.01" y2="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="18" y1="9" x2="18.01" y2="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="6" y1="15" x2="18" y2="15" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
              </svg>
            </div>
            <div className={styles.systemTitleBlock}>
              <div className={styles.systemSubLine}>
                <span className={styles.deviceModel}>XSOS-576D</span>
                <span className={styles.dividerDot}>//</span>
                <span className={styles.chassisId}>SUBRACK-01 · BAY-A</span>
                <span className={styles.dividerDot}>//</span>
                <span className={styles.opticalSpec}>9/125μm SMF LC/APC DUPLEX</span>
              </div>
              <h1 className={styles.mainHeading}>
                Optical Cross-Connect Operations Console
                <span className={styles.liveTag}>LIVE NOC SANDBOX</span>
              </h1>
            </div>
          </div>

          <div className={styles.statusCluster}>
            {/* Authentic Hardware LED Status Strip */}
            <div className={styles.hardwareLedGroup}>
              <div className={styles.ledItem} title="Primary Power Supply 48V DC Nominal">
                <span className={`${styles.ledPin} ${styles.ledPinGreen}`} />
                <span>PSU-1</span>
              </div>
              <div className={styles.ledItem} title="Secondary Redundant Power Supply 48V DC">
                <span className={`${styles.ledPin} ${styles.ledPinGreen}`} />
                <span>PSU-2</span>
              </div>
              <div
                className={styles.ledItem}
                title={`Internal 3-Axis Robotic Fiber Actuator: ${safety.stateLabel}`}
              >
                <span
                  className={`${styles.ledPin} ${
                    safety.state === "ready"
                      ? styles.ledPinGreen
                      : safety.state === "operating"
                      ? styles.ledPinAmber
                      : styles.ledPinRed
                  }`}
                />
                <span>
                  ACTUATOR: {safety.state === "ready" ? "READY" : safety.state === "operating" ? "MOVING" : "LOCKED"}
                </span>
              </div>
              <div
                className={styles.ledItem}
                title={
                  safety.isSafe
                    ? "Safety Interlock Disarmed (Remote actions enabled)"
                    : `Safety Interlock Engaged: ${safety.interlockReason}`
                }
              >
                <span className={`${styles.ledPin} ${safety.isSafe ? styles.ledPinGreen : styles.ledPinAmber}`} />
                <span>{safety.isSafe ? "INTERLOCK: OK" : "INTERLOCK: ENGAGED"}</span>
              </div>
              <div
                className={styles.ledItem}
                title={
                  safety.activeAlarms.length > 0
                    ? safety.activeAlarms.join("; ")
                    : systemStatus.total_notification > 0
                    ? `${systemStatus.total_notification} Pending Notifications`
                    : "Hardware Health Normal"
                }
              >
                <span
                  className={`${styles.ledPin} ${
                    safety.activeAlarms.length > 0 || systemStatus.total_notification > 0
                      ? styles.ledPinRed
                      : styles.ledPinGreen
                  }`}
                />
                <span>
                  {safety.activeAlarms.length > 0
                    ? "ALARM: ACTIVE"
                    : systemStatus.total_notification > 0
                    ? `${systemStatus.total_notification} NOTIF`
                    : "ALARM: NORMAL"}
                </span>
              </div>
              <div className={styles.ledItem} title="Telemetry Heartbeat Response Time">
                <span className={`${styles.ledPin} ${styles.ledPinGreen}`} />
                <span>{lastSyncAt ? `${secondsAgo}s SYNC` : "POLLING"}</span>
              </div>
            </div>

            <button
              className={styles.controlActionBtn}
              onClick={loadLive}
              type="button"
              title="Refresh live optical matrix state"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              Refresh
            </button>

            {/* Operator vs Auditor / Viewer Role Switcher */}
            <div className={styles.roleSelectorGroup}>
              <button
                type="button"
                className={`${styles.roleBtn} ${userRole === "operator" ? styles.roleBtnActiveOperator : ""}`}
                onClick={() => {
                  setUserRole("operator");
                  showToast("Mode diubah ke: NOC Operator (Full Provisioning Access)", "success");
                }}
                title="NOC Operator: Dapat melakukan konfigurasi & dispatch fisik robotik"
              >
                🛡️ Operator
              </button>
              <button
                type="button"
                className={`${styles.roleBtn} ${userRole === "readonly" ? styles.roleBtnActiveReadonly : ""}`}
                onClick={() => {
                  setUserRole("readonly");
                  showToast("Mode diubah ke: Audit Viewer (Read-Only Terkunci)", "success");
                }}
                title="Audit Viewer: Mode inspeksi tanpa modifikasi fisik"
              >
                👁️ Viewer
              </button>
            </div>

            <button
              type="button"
              className={styles.logoutBtn}
              onClick={handleLogout}
              title="Logout sesi NMS (DELETE /authentication/logout)"
            >
              🚪 Logout
            </button>

            <button
              className={styles.primaryDispatchBtn}
              disabled={!safety.isSafe || userRole === "readonly"}
              title={
                userRole === "readonly"
                  ? "Mode Read-Only Aktif: Dispatch sirkuit dinonaktifkan"
                  : safety.isSafe
                  ? "Dispatch optical cross-connect"
                  : `Interlock Engaged: ${safety.interlockReason}`
              }
              style={
                !safety.isSafe || userRole === "readonly"
                  ? { background: "#1e293b", color: "#64748b", cursor: "not-allowed", border: "1px solid #334155" }
                  : {}
              }
              onClick={() => {
                if (!safety.isSafe || userRole === "readonly") return;
                setConnectInitialSource(null);
                setIsConnectOpen(true);
              }}
              type="button"
            >
              {safety.isSafe && userRole !== "readonly" ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
              {userRole === "readonly"
                ? "🔒 Read-Only Session"
                : safety.isSafe
                ? "Dispatch Cross-Connect"
                : "🔒 Dispatch Interlocked"}
            </button>
          </div>
        </div>

        {/* Global Read-Only Notice Banner */}
        {userRole === "readonly" && (
          <div className={styles.readOnlyBannerGlobal}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>🔒</span>
              <span>
                <strong>AUDITOR READ-ONLY SESSION ACTIVE:</strong> Perintah remote actuator dan de-provisioning port dikunci. Semua metrik tetap live.
              </span>
            </div>
            <button
              type="button"
              className={styles.roleBtn}
              style={{
                background: "#0f172a",
                color: "#38bdf8",
                border: "1px solid #1e293b",
                padding: "4px 10px",
                cursor: "pointer",
              }}
              onClick={() => {
                setUserRole("operator");
                showToast("Mode Operator diaktifkan kembali.", "success");
              }}
            >
              Beralih ke Operator
            </button>
          </div>
        )}

        {toast && (
          <div className={`${styles.toastBanner} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
            <span>{toast.message}</span>
            <button className={styles.toastClose} onClick={() => setToast(null)} type="button">
              ✕
            </button>
          </div>
        )}

        {/* Robotic Safety Guard & Hardware Alarm Banner */}
        <SafetyBanner
          safety={safety}
          mode={mode}
          isSimulated={simulatedState !== null}
          onSimulateState={(st, msg, prog) => {
            setSimulatedState({ state: st, customMsg: msg, progress: prog });
            showToast(`Simulasi Pengaman Aktif: ${st.toUpperCase()}`, st === "ready" ? "success" : "error");
          }}
          onResetSimulation={() => {
            setSimulatedState(null);
            showToast("Simulasi dinonaktifkan (kembali ke telemetri normal)", "success");
          }}
        />

        {/* TABBED MODE (Alternative to Option A Single-Page Scroll) */}
        <div className={styles.navTabs5}>
              <button
                type="button"
                className={`${styles.navTab} ${activeTab === "global" ? styles.navTabActive : ""}`}
                onClick={() => setActiveTab("global")}
              >
                <div className={styles.navTabLeft}>
                  <span className={styles.navTabIdx}>01</span>
                  <div className={styles.navTabTitles}>
                    <span className={styles.navTabTitle}>Global Overview</span>
                    <span className={styles.navTabSubtitle}>NOC KPIs &amp; Throughput</span>
                  </div>
                </div>
                <span className={styles.navTabBadge}>ALT+1</span>
              </button>

              <button
                type="button"
                className={`${styles.navTab} ${activeTab === "topology" ? styles.navTabActive : ""}`}
                onClick={() => setActiveTab("topology")}
              >
                <div className={styles.navTabLeft}>
                  <span className={styles.navTabIdx}>02</span>
                  <div className={styles.navTabTitles}>
                    <span className={styles.navTabTitle}>Network Topology</span>
                    <span className={styles.navTabSubtitle}>Facility &amp; Matrix Map</span>
                  </div>
                </div>
                <span className={styles.navTabBadge}>ALT+2</span>
              </button>

              <button
                type="button"
                className={`${styles.navTab} ${activeTab === "bod" ? styles.navTabActive : ""}`}
                onClick={() => setActiveTab("bod")}
              >
                <div className={styles.navTabLeft}>
                  <span className={styles.navTabIdx}>03</span>
                  <div className={styles.navTabTitles}>
                    <span className={styles.navTabTitle}>BoD Orchestrator</span>
                    <span className={styles.navTabSubtitle}>Remote Provisioning</span>
                  </div>
                </div>
                <span className={styles.navTabBadge}>ALT+3</span>
              </button>

              <button
                type="button"
                className={`${styles.navTab} ${activeTab === "sla" ? styles.navTabActive : ""}`}
                onClick={() => setActiveTab("sla")}
              >
                <div className={styles.navTabLeft}>
                  <span className={styles.navTabIdx}>04</span>
                  <div className={styles.navTabTitles}>
                    <span className={styles.navTabTitle}>Availability SLA</span>
                    <span className={styles.navTabSubtitle}>Performance &amp; RCA</span>
                  </div>
                </div>
                <span className={styles.navTabBadge}>ALT+4</span>
              </button>

              <button
                type="button"
                className={`${styles.navTab} ${activeTab === "faults" ? styles.navTabActive : ""}`}
                onClick={() => setActiveTab("faults")}
              >
                <div className={styles.navTabLeft}>
                  <span className={styles.navTabIdx}>05</span>
                  <div className={styles.navTabTitles}>
                    <span className={styles.navTabTitle}>Faults &amp; Events</span>
                    <span className={styles.navTabSubtitle}>Root Cause &amp; Tickets</span>
                  </div>
                </div>
                <span className={styles.navTabBadge}>ALT+5</span>
              </button>

              <button
                type="button"
                className={`${styles.navTab} ${activeTab === "billing" ? styles.navTabActive : ""}`}
                onClick={() => setActiveTab("billing")}
              >
                <div className={styles.navTabLeft}>
                  <span className={styles.navTabIdx}>06</span>
                  <div className={styles.navTabTitles}>
                    <span className={styles.navTabTitle}>CRM &amp; Billing</span>
                    <span className={styles.navTabSubtitle}>Tenants &amp; Invoices</span>
                  </div>
                </div>
                <span className={styles.navTabBadge}>ALT+6</span>
              </button>
            </div>

            {/* Sub-Panel Utility Toolbar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, background: "rgba(11, 17, 30, 0.6)", padding: "7px 14px", borderRadius: 4, border: "1px solid #1a273f" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10.5, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono, monospace)" }}>
                  Hardware Sub-Panels:
                </span>
                <button
                  type="button"
                  className={`${styles.roleBtn} ${activeTab === "monitoring" ? styles.roleBtnActiveOperator : ""}`}
                  onClick={() => setActiveTab("monitoring")}
                  style={{ padding: "4px 9px", fontSize: 11 }}
                >
                  🎛️ Raw 288-Port Matrix Bay
                </button>
                <button
                  type="button"
                  className={`${styles.roleBtn} ${activeTab === "setting" ? styles.roleBtnActiveOperator : ""}`}
                  onClick={() => setActiveTab("setting")}
                  style={{ padding: "4px 9px", fontSize: 11 }}
                >
                  ⚙️ Actuator &amp; Inventory
                </button>
                <button
                  type="button"
                  className={`${styles.roleBtn} ${activeTab === "logging" ? styles.roleBtnActiveOperator : ""}`}
                  onClick={() => setActiveTab("logging")}
                  style={{ padding: "4px 9px", fontSize: 11 }}
                >
                  📜 Work Orders ({connections.length + queue.length})
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className={styles.roleBtn}
                  style={{ padding: "4px 8px", fontSize: 11, color: "#34d399", borderColor: "rgba(16, 185, 129, 0.4)" }}
                  onClick={() => setLayoutMode("scroll")}
                >
                  📜 Switch to Option A (Single-Page Scroll)
                </button>
              </div>
            </div>

            {activeTab === "global" && (
              <GlobalDashboardView
                summary={summary}
                systemStatus={systemStatus}
                onNavigateTab={setActiveTab}
              />
            )}
            {activeTab === "topology" && (
              <NetworkTopologyView
                ports={ports}
                onSelectPort={(port) => {
                  setSelected(`${port.panel_name}#${port.port_no}`);
                }}
                onOpenConnect={() => {
                  setConnectInitialSource(null);
                  setIsConnectOpen(true);
                }}
              />
            )}
            {activeTab === "bod" && (
              <BodOrchestratorView
                onDispatchConnect={handleConnect}
                readOnly={userRole === "readonly"}
              />
            )}
            {activeTab === "sla" && <SlaAnalyticsView />}
            {activeTab === "faults" && <FaultsEventsView />}
            {activeTab === "billing" && <CrmBillingView />}
            {activeTab === "logging" && (
              <LoggingView
                connections={connections}
                queue={queue}
                onRefresh={loadLive}
                onSelectPort={(panel, portNo) => {
                  setActiveTab("monitoring");
                  setSelected(`${panel}#${portNo}`);
                }}
              />
            )}
            {activeTab === "setting" && (
              <SettingView
                inventory={inventory}
                connections={connections}
                ports={ports}
                safety={safety}
                readOnly={userRole === "readonly"}
                onOpenConnectModal={() => {
                  setConnectInitialSource(null);
                  setIsConnectOpen(true);
                }}
                onOpenDisconnectModal={(port) => {
                  setDisconnectPort(port);
                }}
                onOpenDisconnectConnectionModal={(conn) => {
                  setDisconnectConnection(conn);
                }}
                onRefresh={loadLive}
              />
            )}

        {activeTab === "monitoring" && (
          <>
            {/* 5 Telemetry Metrics */}
            <div className={styles.stats}>
              <div className={styles.statCard}>
                <div className={styles.statTop}>
                  <span className={styles.statLabel}>Total LC Ports</span>
                  <span className={styles.statSubtext}>{panels.length} Subracks Bay</span>
                </div>
                <div className={styles.statValRow}>
                  <div className={styles.n}>{summary.total_ports}</div>
                  <span className={styles.statPercent}>576 Optical Cores</span>
                </div>
              </div>

              <div className={`${styles.statCard} ${styles.statAvailable}`}>
                <div className={styles.statTop}>
                  <span className={styles.statLabel}>Available Feeds</span>
                  <span className={styles.statSubtext}>Ready to Cross-Connect</span>
                </div>
                <div className={styles.statValRow}>
                  <div className={styles.n}>{summary.available_ports}</div>
                  <span className={styles.statPercent}>
                    {((summary.available_ports / summary.total_ports) * 100).toFixed(1)}% Free
                  </span>
                </div>
              </div>

              <div className={`${styles.statCard} ${styles.statConnected}`}>
                <div className={styles.statTop}>
                  <span className={styles.statLabel}>Active Circuits</span>
                  <span className={styles.statSubtext}>Laser Transmitting</span>
                </div>
                <div className={styles.statValRow}>
                  <div className={styles.n}>{summary.connected_port}</div>
                  <span className={styles.statPercent}>
                    {((summary.connected_port / summary.total_ports) * 100).toFixed(1)}% Patched
                  </span>
                </div>
              </div>

              <div className={`${styles.statCard} ${styles.statInterconnect}`}>
                <div className={styles.statTop}>
                  <span className={styles.statLabel}>Interconnection</span>
                  <span className={styles.statSubtext}>Subrack Tie-Lines</span>
                </div>
                <div className={styles.statValRow}>
                  <div className={styles.n} style={{ color: "#c084fc" }}>{summary.interconnection_port}</div>
                  <span className={styles.statPercent} style={{ color: "#a855f7" }}>
                    Reserved Backbone
                  </span>
                </div>
              </div>

              <div className={`${styles.statCard}`}>
                <div className={styles.statTop}>
                  <span className={styles.statLabel}>Customer Leased</span>
                  <span className={styles.statSubtext}>Tenant Dedicated</span>
                </div>
                <div className={styles.statValRow}>
                  <div className={styles.n} style={{ color: "#38bdf8" }}>{customerAllocatedCount}</div>
                  <span className={styles.statPercent} style={{ color: "#0284c7" }}>
                    Allocated Circuits
                  </span>
                </div>
              </div>
            </div>

            {/* ODF Chassis & Side Panel */}
            <div className={styles.layout}>
              <div className={styles.odfChassisFrame}>
                <div className={styles.chassisBezelHead}>
                  <div className={styles.chassisTitleGroup}>
                    <span className={styles.rackEar}>4RU // TELECOM BAY</span>
                    <h2>Optical Distribution Frame (ODF) — Physical Cassette Bay</h2>
                  </div>
                  <div className={styles.chassisTelemetryTags}>
                    <span className={styles.telemetryTag}>
                      {summary.connected_port} Circuits Live · 0 Alarms
                    </span>
                    <span className={styles.telemetryTag}>IL: 0.28 dB typ.</span>
                  </div>
                </div>

                <div className={styles.odfBody}>
                  {/* Multi-Chassis Subrack Switcher */}
                  <div className={styles.chassisSwitcher}>
                    <div className={styles.chassisSwitcherLeft}>
                      <span className={styles.chassisSwitcherLabel}>Subrack Chassis:</span>
                      <div className={styles.chassisSwitchBtnGroup}>
                        <button
                          type="button"
                          className={`${styles.chassisSwitchBtn} ${selectedChassis === "all" ? styles.chassisSwitchBtnActive : ""}`}
                          onClick={() => setSelectedChassis("all")}
                        >
                          All Subracks ({panels.length} Units)
                        </button>
                        {panels.map((p) => {
                          const pPorts = portsByPanel[p] || [];
                          const pConnected = pPorts.filter((x) => x.status === "Connected").length;
                          return (
                            <button
                              key={p}
                              type="button"
                              className={`${styles.chassisSwitchBtn} ${selectedChassis === p ? styles.chassisSwitchBtnActive : ""}`}
                              onClick={() => setSelectedChassis(p)}
                            >
                              <span className={styles.ledPinGreen} style={{ width: 6, height: 6 }} />
                              {p} ({pConnected}/{pPorts.length} Active)
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className={styles.chassisMetaBadge}>
                      {selectedChassis === "all"
                        ? `Displaying all ${summary.total_ports} ports across ${panels.length} chassis`
                        : `Viewing: ${selectedChassis} (288 LC Duplex Ports)`}
                    </div>
                  </div>

                  {/* Search and Filters toolbar */}
                  <div className={styles.filtersToolbar}>
                    <input
                      className={styles.searchInput}
                      placeholder="Filter port coordinate, panel, atau customer (e.g. Telkomsel, P-018, XSOS-576D-1)…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <div className={styles.filterGroup}>
                      {(["all", "Available", "Connected", "Interconnection", "Customer", "Disabled"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`${styles.chip} ${statusFilter === s ? styles.chipActive : ""}`}
                          onClick={() => setStatusFilter(s)}
                        >
                          {s === "all"
                            ? "Semua Status"
                            : s === "Interconnection"
                            ? `⇄ Interconnection (${summary.interconnection_port})`
                            : s === "Customer"
                            ? `🏢 Customer Leased (${customerAllocatedCount})`
                            : s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {displayedPanels.map((panel) => {
                    const panelPorts = portsByPanel[panel] || [];
                    const totalPanelPorts = panelPorts.length || PORTS_PER_PANEL;
                    const half = Math.ceil(totalPanelPorts / 2);
                    const eastPorts = panelPorts.slice(0, half);
                    const westPorts = panelPorts.slice(half);

                    return (
                      <div key={panel}>
                        {/* Cassette Tray 1: East Bay (Demarcation) */}
                        <div className={styles.opticalCassetteBay}>
                          <div className={styles.cassetteHeader}>
                            <div className={styles.cassetteTitle}>
                              <span className={`${styles.cassetteBadge} ${styles.cassetteEast}`}>
                                EAST CASSETTE
                              </span>
                              <span className={styles.cassetteName}>
                                Demarcation & Incoming Feeder Bay (Ports 001 – {half.toString().padStart(3, "0")})
                              </span>
                            </div>
                            <span className={styles.cassetteSpec}>9/125μm Single Mode LC/APC</span>
                          </div>

                          <div className={styles.portGridContainer}>
                            {eastPorts.map((p) => {
                              const key = `${p.panel_name}#${p.port_no}`;
                              const statusClass =
                                p.status === "Available"
                                  ? styles.portAvailable
                                  : p.status === "Connected"
                                  ? styles.portConnected
                                  : styles.portDisabled;
                              const interconnClass = p.reserved_as_interconnection ? styles.portInterconnection : "";
                              return (
                                <div
                                  key={key}
                                  className={[
                                    styles.portSocket,
                                    statusClass,
                                    interconnClass,
                                    matches(p) ? "" : styles.portDim,
                                    selected === key ? styles.portSelected : "",
                                  ].join(" ")}
                                  title={`${p.description} · ${p.status}${p.connected_port ? ` → ${p.connected_port}` : ""}${p.reserved_as_interconnection ? " · [Interconnection Trunk]" : ""}${p.allocated_to_customer ? ` · [Customer: ${p.allocated_to_customer}]` : ""}`}
                                  onClick={() => setSelected(key)}
                                >
                                  <div className={styles.portLatchNotch} />
                                  <div className={styles.opticalCore} />
                                  {p.reserved_as_interconnection && (
                                    <span className={styles.interconnBadge} title="Interconnection Trunk">⇄</span>
                                  )}
                                  {p.allocated_to_customer && (
                                    <span className={styles.customerBadge} title={`Customer: ${p.allocated_to_customer}`}>🏢</span>
                                  )}
                                  <span className={styles.portNumberLabel}>
                                    {p.port_no.toString().padStart(3, "0")}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Cassette Tray 2: West Bay (Distribution) */}
                        <div className={styles.opticalCassetteBay}>
                          <div className={styles.cassetteHeader}>
                            <div className={styles.cassetteTitle}>
                              <span className={`${styles.cassetteBadge} ${styles.cassetteWest}`}>
                                WEST CASSETTE
                              </span>
                              <span className={styles.cassetteName}>
                                Distribution & Equipment Cross-Connect Bay (Ports {(half + 1).toString().padStart(3, "0")} – {totalPanelPorts.toString().padStart(3, "0")})
                              </span>
                            </div>
                            <span className={styles.cassetteSpec}>Robotic Optical Switch Fabric</span>
                          </div>

                          <div className={styles.portGridContainer}>
                            {westPorts.map((p) => {
                              const key = `${p.panel_name}#${p.port_no}`;
                              const statusClass =
                                p.status === "Available"
                                  ? styles.portAvailable
                                  : p.status === "Connected"
                                  ? styles.portConnected
                                  : styles.portDisabled;
                              const interconnClass = p.reserved_as_interconnection ? styles.portInterconnection : "";
                              return (
                                <div
                                  key={key}
                                  className={[
                                    styles.portSocket,
                                    statusClass,
                                    interconnClass,
                                    matches(p) ? "" : styles.portDim,
                                    selected === key ? styles.portSelected : "",
                                  ].join(" ")}
                                  title={`${p.description} · ${p.status}${p.connected_port ? ` → ${p.connected_port}` : ""}${p.reserved_as_interconnection ? " · [Interconnection Trunk]" : ""}${p.allocated_to_customer ? ` · [Customer: ${p.allocated_to_customer}]` : ""}`}
                                  onClick={() => setSelected(key)}
                                >
                                  <div className={styles.portLatchNotch} />
                                  <div className={styles.opticalCore} />
                                  {p.reserved_as_interconnection && (
                                    <span className={styles.interconnBadge} title="Interconnection Trunk">⇄</span>
                                  )}
                                  {p.allocated_to_customer && (
                                    <span className={styles.customerBadge} title={`Customer: ${p.allocated_to_customer}`}>🏢</span>
                                  )}
                                  <span className={styles.portNumberLabel}>
                                    {p.port_no.toString().padStart(3, "0")}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className={styles.odfLegend}>
                    <div className={styles.legendItem}>
                      <span className={styles.legendPip} style={{ background: "#0284c7" }} />
                      <span>Available</span>
                    </div>
                    <div className={styles.legendItem}>
                      <span className={styles.legendPip} style={{ background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                      <span>Connected</span>
                    </div>
                    <div className={styles.legendItem}>
                      <span className={styles.legendPip} style={{ background: "#a855f7", border: "1px solid #c084fc" }} />
                      <span>⇄ Interconnection Trunk</span>
                    </div>
                    <div className={styles.legendItem}>
                      <span className={styles.legendPip} style={{ background: "#38bdf8" }} />
                      <span>🏢 Customer Leased</span>
                    </div>
                    <div className={styles.legendItem}>
                      <span className={styles.legendPip} style={{ background: "#475569" }} />
                      <span>Disabled</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Side Column: Active Cross-Connects & Actuator Queue */}
              <div className={styles.sideColumn}>
                <div className={styles.sideCard}>
                  <div className={styles.sideCardHead}>
                    <h3>Active Cross-Connect Circuits</h3>
                    <span className={styles.navTabBadge}>{filteredConnections.length} Circuits</span>
                  </div>
                  <div className={styles.sideCardBody}>
                    {filteredConnections.length === 0 && (
                      <div className={styles.emptyNotice} style={{ padding: 12 }}>
                        Tidak ada sirkuit aktif yang sesuai kriteria.
                      </div>
                    )}
                    {filteredConnections.slice(0, 30).map((c) => (
                      <div
                        className={styles.connRow}
                        key={c.connection_id}
                        onClick={() => setSelected(`${c.source[0].panel_name}#${c.source[0].port_no}`)}
                      >
                        <div className={styles.connRoute}>
                          <span className={styles.portChip}>P-{c.source[0].port_no}</span>
                          <span className={styles.routeArrow}>━━⚡━━►</span>
                          <span className={styles.portChip}>P-{c.target[0].port_no}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span className={styles.connMeta}>#{c.connection_id}</span>
                          <button
                            type="button"
                            className={styles.connDisconnectBtn}
                            title={`Disconnect Circuit #${c.connection_id} (API 2.3)`}
                            disabled={(safety && !safety.isSafe) || userRole === "readonly"}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDisconnectConnection(c);
                            }}
                          >
                            ✂️ Putus
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.sideCard}>
                  <div className={styles.sideCardHead}>
                    <h3>Robotic Actuator Queue</h3>
                    <span className={styles.navTabBadge}>{queue.length} Tasks</span>
                  </div>
                  <div className={styles.sideCardBody}>
                    {queue.length === 0 && (
                      <div className={styles.emptyNotice} style={{ padding: 12 }}>
                        Tidak ada tugas robotik tertunda.
                      </div>
                    )}
                    {queue.map((t) => (
                      <div className={styles.connRow} key={t.connection_id}>
                        <div>
                          <div className={styles.connRoute} style={{ fontSize: 11 }}>
                            <span>P-{t.source[0].port_no} → P-{t.target[0].port_no}</span>
                          </div>
                          <div className={styles.connMeta} style={{ marginTop: 2 }}>
                            {t.operation_name} · {t.scheduled_at ? t.scheduled_at.replace("T", " ") : "Immediately"}
                          </div>
                        </div>
                        <span
                          className={`${styles.statusBadge} ${
                            t.status === "Waiting" ? styles.badgeWaiting : styles.badgeOperating
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className={styles.footnote}>
          Xenoptics XSOS-576D Remote Optical Switch System · Live NOC Integration via nms-proxy (FastAPI) · Telemetry Poll Rate: 8000ms
        </div>
      </div>

      {/* Port Inspection Drawer */}
      {selectedPort && (
        <div className={styles.drawerOverlay} onClick={() => setSelected(null)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHead}>
              <h3>PORT INSPECTION: {selectedPort.description}</h3>
              <button className={styles.drawerClose} onClick={() => setSelected(null)} type="button">
                ✕
              </button>
            </div>

            {/* Customer Allocation Badge */}
            <div className={styles.drawerCustomerCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "#38bdf8", fontWeight: 700, fontFamily: "var(--font-mono, monospace)" }}>
                  🏢 CUSTOMER ALLOCATION
                </span>
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 2, background: selectedPort.allocated_to_customer ? "rgba(56, 189, 248, 0.2)" : "rgba(100, 116, 139, 0.2)", color: selectedPort.allocated_to_customer ? "#7dd3fc" : "#94a3b8" }}>
                  {selectedPort.allocated_to_customer ? "LEASED / ACTIVE" : "UNALLOCATED"}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: selectedPort.allocated_to_customer ? "#f1f5f9" : "#64748b" }}>
                {selectedPort.allocated_to_customer ?? "Standard unallocated port (Available for customer cross-connect assignment)"}
              </div>
            </div>

            {/* Interconnection Trunk Banner if applicable */}
            {selectedPort.reserved_as_interconnection && (
              <div className={styles.drawerInterconnCard}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#c084fc", fontWeight: 700, fontFamily: "var(--font-mono, monospace)" }}>
                    ⇄ INTER-CHASSIS BACKBONE TIE-LINE
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#e9d5ff", lineHeight: 1.4 }}>
                  Reserved internal trunk link between <strong>{selectedPort.panel_name}</strong> and adjacent optical subrack cassette bay.
                </div>
              </div>
            )}

            <div className={styles.drawerGrid}>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>Circuit Status</span>
                <span
                  className={styles.kvVal}
                  style={{
                    color: selectedPort.status === "Connected" ? "#34d399" : "#38bdf8",
                    fontWeight: 700,
                  }}
                >
                  {selectedPort.status.toUpperCase()}
                </span>
              </div>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>Chassis Subrack</span>
                <span className={styles.kvVal}>{selectedPort.panel_name}</span>
              </div>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>Connected Partner</span>
                <span className={styles.kvVal}>{selectedPort.connected_port ?? "None (Isolated)"}</span>
              </div>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>Optical Fiber Spec</span>
                <span className={styles.kvVal}>{selectedPort.fiber_type} (SMF-28e)</span>
              </div>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>SMU Controller Type</span>
                <span className={styles.kvVal}>{selectedPort.smu_type}</span>
              </div>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>SMU Serial Number</span>
                <span className={styles.kvVal}>{selectedPort.serial_no ?? "—"}</span>
              </div>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>Interconnection Reserve</span>
                <span className={styles.kvVal}>
                  {selectedPort.reserved_as_interconnection ? "ENABLED (TRUNK)" : "DISABLED (ACCESS)"}
                </span>
              </div>

              {/* Mechanical Port Wear Gauge */}
              {(() => {
                const wear = selectedPort.connected_count ?? 0;
                return (
                  <div className={styles.kvItem} style={{ gridColumn: "1 / -1" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                      <span className={styles.kvKey}>Mechanical Port Wear Gauge</span>
                      <span className={styles.kvVal} style={{ color: wear > 200 ? "#f59e0b" : "#34d399", fontWeight: 600 }}>
                        {wear} / 1,000 cycles ({((wear / 1000) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className={styles.wearGaugeContainer} style={{ width: "100%" }}>
                      <div className={styles.wearGaugeBar}>
                        <div
                          className={styles.wearGaugeFill}
                          style={{
                            width: `${Math.min(100, Math.max(3, (wear / 1000) * 100))}%`,
                            background: wear > 200 ? "#f59e0b" : "#10b981",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 10.5, color: "#64748b", fontFamily: "var(--font-mono, monospace)" }}>
                        {wear < 50
                          ? "● Optimal Mechanical Health (< 5% Rated Life)"
                          : wear <= 200
                          ? "● Normal Operational Durability"
                          : "▲ High Wear: Schedule Optical End-Face Scope Inspection"}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className={styles.drawerSectionTitle}>Physical Port Actions</div>

            {userRole === "readonly" && (
              <div className={styles.readOnlyNotice} style={{ marginBottom: 12 }}>
                <span>🔒 <strong>Mode Read-Only:</strong> Modifikasi sirkuit pada port ini dinonaktifkan dalam mode Audit Viewer.</span>
              </div>
            )}

            {selectedPort.status === "Available" && (
              <button
                type="button"
                className={styles.primaryDispatchBtn}
                disabled={!safety.isSafe || userRole === "readonly"}
                style={
                  !safety.isSafe || userRole === "readonly"
                    ? {
                        width: "100%",
                        justifyContent: "center",
                        padding: "11px 16px",
                        background: "#1e293b",
                        color: "#64748b",
                        cursor: "not-allowed",
                        border: "1px solid #334155",
                      }
                    : { width: "100%", justifyContent: "center", padding: "11px 16px" }
                }
                onClick={() => {
                  if (!safety.isSafe || userRole === "readonly") return;
                  setConnectInitialSource({ panel: selectedPort.panel_name, port: selectedPort.port_no });
                  setIsConnectOpen(true);
                }}
              >
                {userRole === "readonly"
                  ? "🔒 Provision Locked (Read-Only Mode)"
                  : !safety.isSafe
                  ? "🔒 Provision Locked (Interlock)"
                  : "Provision Cross-Connect from This Port"}
              </button>
            )}

            {selectedPort.status === "Connected" && (() => {
              const activeConn = connections.find(
                (c) =>
                  (c.source[0]?.panel_name === selectedPort.panel_name && c.source[0]?.port_no === selectedPort.port_no) ||
                  (c.target[0]?.panel_name === selectedPort.panel_name && c.target[0]?.port_no === selectedPort.port_no)
              );
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                  {activeConn && (
                    <button
                      type="button"
                      className={styles.pickerDisconnectBtn}
                      disabled={!safety.isSafe || userRole === "readonly"}
                      style={
                        !safety.isSafe || userRole === "readonly"
                          ? {
                              width: "100%",
                              padding: "11px 16px",
                              fontSize: 12,
                              justifyContent: "center",
                              display: "flex",
                              background: "#1e293b",
                              color: "#64748b",
                              cursor: "not-allowed",
                              borderColor: "#334155",
                            }
                          : { width: "100%", padding: "11px 16px", fontSize: 12, justifyContent: "center", display: "flex", background: "rgba(14, 165, 233, 0.15)", borderColor: "#0284c7", color: "#38bdf8" }
                      }
                      onClick={() => {
                        if (!safety.isSafe || userRole === "readonly") return;
                        setDisconnectConnection(activeConn);
                      }}
                    >
                      {userRole === "readonly"
                        ? "🔒 De-provision Locked (Read-Only Mode)"
                        : !safety.isSafe
                        ? "🔒 De-provision Locked (Interlock)"
                        : `Putus Sirkuit #${activeConn.connection_id} (API 2.3)`}
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.pickerDisconnectBtn}
                    disabled={!safety.isSafe || userRole === "readonly"}
                    style={
                      !safety.isSafe || userRole === "readonly"
                        ? {
                            width: "100%",
                            padding: "11px 16px",
                            fontSize: 12,
                            justifyContent: "center",
                            display: "flex",
                            background: "#1e293b",
                            color: "#64748b",
                            cursor: "not-allowed",
                            borderColor: "#334155",
                          }
                        : { width: "100%", padding: "11px 16px", fontSize: 12, justifyContent: "center", display: "flex" }
                    }
                    onClick={() => {
                      if (!safety.isSafe || userRole === "readonly") return;
                      setDisconnectPort(selectedPort);
                    }}
                  >
                    {userRole === "readonly"
                      ? "🔒 De-provision Locked (Read-Only Mode)"
                      : !safety.isSafe
                      ? "🔒 De-provision Locked (Interlock)"
                      : "Putus Port Fisik (API 2.2)"}
                  </button>
                </div>
              );
            })()}

            {!safety.isSafe && (
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 10px",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  borderRadius: 3,
                  fontSize: 11,
                  color: "#f87171",
                  fontFamily: "var(--font-mono, monospace)",
                  lineHeight: 1.4,
                }}
              >
                ⚠️ Action Disabled: {safety.interlockReason}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connect Modal */}
      <ConnectModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        ports={ports}
        panels={panels}
        initialSource={connectInitialSource}
        safety={safety}
        readOnly={userRole === "readonly"}
        onConnect={handleConnect}
      />

      {/* Disconnect Modal */}
      {disconnectPort && (
        <DisconnectModal
          isOpen={true}
          onClose={() => setDisconnectPort(null)}
          port={disconnectPort}
          safety={safety}
          readOnly={userRole === "readonly"}
          onDisconnect={handleDisconnect}
        />
      )}
      {disconnectConnection && (
        <DisconnectModal
          isOpen={true}
          onClose={() => setDisconnectConnection(null)}
          connection={disconnectConnection}
          safety={safety}
          readOnly={userRole === "readonly"}
          onDisconnectById={handleDisconnectById}
        />
      )}
    </div>
  );
}
