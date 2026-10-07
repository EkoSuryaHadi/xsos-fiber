"use client";

import { useMemo, useState } from "react";
import styles from "./NmsDashboard.module.css";
import type { ConnectionItem, QueueItem } from "@/types/nms";

interface LoggingViewProps {
  connections: ConnectionItem[];
  queue: QueueItem[];
  onRefresh: () => void;
  onSelectPort?: (panel: string, portNo: number) => void;
}

export default function LoggingView({
  connections,
  queue,
  onRefresh,
  onSelectPort,
}: LoggingViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [opFilter, setOpFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<ConnectionItem | null>(null);

  // Combine completed connections and queued tasks
  const allLogs = useMemo(() => {
    const list: Array<ConnectionItem & { isQueue?: boolean; queueStatus?: string }> = [
      ...queue.map((q) => ({ ...q, isQueue: true, queueStatus: q.status })),
      ...connections,
    ];
    return list;
  }, [connections, queue]);

  // Extract unique operators
  const uniqueUsers = useMemo(() => {
    const s = new Set<string>();
    allLogs.forEach((item) => {
      if (item.created_by) s.add(item.created_by);
    });
    return Array.from(s).sort();
  }, [allLogs]);

  // Filtering
  const filteredLogs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allLogs.filter((item) => {
      if (opFilter !== "all" && item.operation_name.toLowerCase() !== opFilter.toLowerCase()) {
        return false;
      }
      if (userFilter !== "all" && item.created_by !== userFilter) {
        return false;
      }
      if (!q) return true;

      const src = item.source[0]?.port_description?.toLowerCase() || "";
      const tgt = item.target[0]?.port_description?.toLowerCase() || "";
      const user = item.created_by?.toLowerCase() || "";
      const remark = item.remark?.toLowerCase() || "";
      const idStr = String(item.connection_id);

      return (
        src.includes(q) ||
        tgt.includes(q) ||
        user.includes(q) ||
        remark.includes(q) ||
        idStr.includes(q)
      );
    });
  }, [allLogs, searchTerm, opFilter, userFilter]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      "Circuit ID",
      "Event Type",
      "Source Panel",
      "Source Port",
      "Target Panel",
      "Target Port",
      "NOC Operator",
      "Timestamp Requested",
      "Actuator Start",
      "Actuator Finish",
      "Scheduled Dispatch",
      "Execution Status",
      "Work Order Remarks",
    ];

    const rows = filteredLogs.map((item) => [
      item.connection_id,
      item.operation_name,
      item.source[0]?.panel_name || "",
      item.source[0]?.port_no || "",
      item.target[0]?.panel_name || "",
      item.target[0]?.port_no || "",
      item.created_by || "System",
      item.created_at || "",
      item.started_at || "",
      item.finished_at || "",
      item.scheduled_at || "",
      item.isQueue ? item.queueStatus : "Completed",
      `"${(item.remark || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `XSOS_Audit_Telemetry_Trail_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const calculateDuration = (start?: string, finish?: string) => {
    if (!start || !finish) return "—";
    try {
      const ms = new Date(finish).getTime() - new Date(start).getTime();
      if (isNaN(ms) || ms < 0) return "—";
      const sec = Math.round(ms / 1000);
      return `${sec}s`;
    } catch {
      return "—";
    }
  };

  return (
    <div className={styles.loggingContainer}>
      <div className={styles.logHeader}>
        <div>
          <h2>Mission-Critical Audit Trail & Robotic Actuator Telemetry</h2>
          <p className={styles.logSubtitle}>
            Immutable forensic log of all robotic optical switch cross-connects, circuit tears, and actuator execution timings.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className={styles.controlActionBtn}
            onClick={onRefresh}
            title="Poll fresh audit telemetry"
          >
            ↻ Re-sync Telemetry
          </button>
          <button
            type="button"
            className={styles.exportCsvBtn}
            onClick={handleExportCSV}
          >
            📥 Export Forensic Audit CSV
          </button>
        </div>
      </div>

      {/* Forensic Telemetry Strip */}
      <div className={styles.logMetricsStrip}>
        <div className={styles.logMetricBox}>
          <div className={styles.logMetricNum}>{allLogs.length}</div>
          <div className={styles.logMetricLabel}>Total Executed Work Orders</div>
        </div>
        <div className={styles.logMetricBox}>
          <div className={styles.logMetricNum} style={{ color: "#34d399" }}>
            {connections.length}
          </div>
          <div className={styles.logMetricLabel}>Active Physical Circuits</div>
        </div>
        <div className={styles.logMetricBox}>
          <div className={styles.logMetricNum} style={{ color: "#fbbf24" }}>
            {queue.length}
          </div>
          <div className={styles.logMetricLabel}>Pending Dispatch Queue</div>
        </div>
        <div className={styles.logMetricBox}>
          <div className={styles.logMetricNum} style={{ color: "#38bdf8" }}>
            {uniqueUsers.length}
          </div>
          <div className={styles.logMetricLabel}>Authorized NOC Operators</div>
        </div>
      </div>

      {/* Filter and Query Bar */}
      <div className={styles.logFilterBar}>
        <input
          className={styles.searchInput}
          placeholder="Filter by circuit ID, port coordinate, operator token, or remark…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ minWidth: 280 }}
        />

        <select
          className={styles.filterSelect}
          value={opFilter}
          onChange={(e) => setOpFilter(e.target.value)}
        >
          <option value="all">All Operations</option>
          <option value="Connect">Connect (Cross-Connect)</option>
          <option value="Disconnect">Disconnect (Tear Down)</option>
        </select>

        <select
          className={styles.filterSelect}
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
        >
          <option value="all">All NOC Operators</option>
          {uniqueUsers.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>

        <span className={styles.statSubtext} style={{ marginLeft: 8 }}>
          Showing {filteredLogs.length} of {allLogs.length} records
        </span>
      </div>

      {/* High-Density Audit Table */}
      <div className={styles.logTableContainer}>
        <table className={styles.logTable}>
          <thead>
            <tr>
              <th>Circuit ID</th>
              <th>Dispatch Timestamp</th>
              <th>Operation</th>
              <th>Optical Path (Source ━━► Target)</th>
              <th>NOC Operator</th>
              <th>Actuator Execution</th>
              <th>Status</th>
              <th>Work Order Remarks</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
                  No audit records match the specified query filters.
                </td>
              </tr>
            ) : (
              filteredLogs.map((item) => {
                const src = item.source[0];
                const tgt = item.target[0];
                return (
                  <tr
                    key={`${item.connection_id}-${item.isQueue ? "q" : "c"}`}
                    onClick={() => setSelectedLog(item)}
                    className={styles.logTableRow}
                  >
                    <td className={styles.idCell}>#{item.connection_id}</td>
                    <td className={styles.timeCell}>
                      <div>{item.created_at ? item.created_at.replace("T", " ") : "—"}</div>
                      <span className={styles.timeMuted}>UTC Recorded</span>
                    </td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          item.operation_name === "Connect"
                            ? styles.badgeConnected
                            : styles.badgeWaiting
                        }`}
                      >
                        {item.operation_name.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div className={styles.routeVisualCell}>
                        <span
                          className={styles.portChip}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (src && onSelectPort) onSelectPort(src.panel_name, src.port_no);
                          }}
                          style={{ cursor: "pointer" }}
                          title="Jump to port in Monitoring Bay"
                        >
                          {src ? `P-${src.port_no.toString().padStart(3, "0")}` : "—"}
                        </span>
                        <span className={styles.routeBeam}>━━⚡━━►</span>
                        <span
                          className={styles.portChip}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (tgt && onSelectPort) onSelectPort(tgt.panel_name, tgt.port_no);
                          }}
                          style={{ cursor: "pointer" }}
                          title="Jump to port in Monitoring Bay"
                        >
                          {tgt ? `P-${tgt.port_no.toString().padStart(3, "0")}` : "—"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.operatorBadge}>{item.created_by || "SYSTEM_DAEMON"}</span>
                    </td>
                    <td className={styles.timeCell}>
                      {item.started_at && item.finished_at ? (
                        <div>
                          <span style={{ color: "#38bdf8", fontWeight: 600 }}>
                            {calculateDuration(item.started_at, item.finished_at)}
                          </span>
                          <span className={styles.timeMuted}> (Robot Arm)</span>
                        </div>
                      ) : (
                        <span className={styles.timeMuted}>Awaiting Move</span>
                      )}
                    </td>
                    <td>
                      {item.isQueue ? (
                        <span
                          className={`${styles.statusBadge} ${
                            item.queueStatus === "Waiting" ? styles.badgeWaiting : styles.badgeOperating
                          }`}
                        >
                          {item.queueStatus?.toUpperCase()}
                        </span>
                      ) : (
                        <span className={`${styles.statusBadge} ${styles.badgeConnected}`}>
                          ✓ VERIFIED
                        </span>
                      )}
                    </td>
                    <td style={{ color: "#94a3b8", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.remark || "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Forensic Detail Drawer */}
      {selectedLog && (
        <div className={styles.drawerOverlay} onClick={() => setSelectedLog(null)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHead}>
              <h3>WORK ORDER AUDIT #{selectedLog.connection_id}</h3>
              <button
                className={styles.drawerClose}
                onClick={() => setSelectedLog(null)}
                type="button"
              >
                ✕
              </button>
            </div>

            <div className={styles.drawerGrid}>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>Operation Type</span>
                <span className={styles.kvVal}>{selectedLog.operation_name}</span>
              </div>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>Source Port Coordinate</span>
                <span className={styles.kvVal}>
                  {selectedLog.source[0]?.panel_name} P-{selectedLog.source[0]?.port_no}
                </span>
              </div>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>Target Port Coordinate</span>
                <span className={styles.kvVal}>
                  {selectedLog.target[0]?.panel_name} P-{selectedLog.target[0]?.port_no}
                </span>
              </div>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>NOC Operator Token</span>
                <span className={styles.kvVal}>{selectedLog.created_by || "System"}</span>
              </div>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>Dispatch Registered</span>
                <span className={styles.kvVal}>{selectedLog.created_at || "—"}</span>
              </div>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>Actuator Travel Start</span>
                <span className={styles.kvVal}>{selectedLog.started_at || "—"}</span>
              </div>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>Actuator Lock Complete</span>
                <span className={styles.kvVal}>{selectedLog.finished_at || "—"}</span>
              </div>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>Actuator Travel Duration</span>
                <span className={styles.kvVal} style={{ color: "#38bdf8", fontWeight: 700 }}>
                  {calculateDuration(selectedLog.started_at, selectedLog.finished_at)}
                </span>
              </div>
            </div>

            <div className={styles.drawerSectionTitle}>Raw Telemetry Payload</div>
            <pre className={styles.drawerCodeBlock}>
              {JSON.stringify(selectedLog, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
