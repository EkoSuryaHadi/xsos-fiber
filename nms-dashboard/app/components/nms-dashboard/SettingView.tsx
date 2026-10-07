"use client";

import styles from "./NmsDashboard.module.css";
import type { ConnectionItem, InventoryItem, Port } from "@/types/nms";
import type { SafetyAssessment } from "@/lib/safety";

interface SettingViewProps {
  inventory: InventoryItem[];
  connections: ConnectionItem[];
  ports: Record<string, Port>;
  safety?: SafetyAssessment;
  readOnly?: boolean;
  onOpenConnectModal: () => void;
  onOpenDisconnectModal: (port: Port) => void;
  onOpenDisconnectConnectionModal?: (connection: ConnectionItem) => void;
  onRefresh: () => void;
}

export default function SettingView({
  inventory,
  connections,
  ports,
  safety,
  readOnly = false,
  onOpenConnectModal,
  onOpenDisconnectModal,
  onOpenDisconnectConnectionModal,
  onRefresh,
}: SettingViewProps) {
  return (
    <div className={styles.settingContainer}>
      {/* Header */}
      <div className={styles.logHeader}>
        <div>
          <h2>Optical Switch Fabric & Hardware Provisioning Controller</h2>
          <p className={styles.logSubtitle}>
            Precision robotic actuator commands, optical link budget planning, physical subrack inventory, and gateway parameters.
          </p>
        </div>
        <button
          type="button"
          className={styles.controlActionBtn}
          onClick={onRefresh}
          title="Refresh physical subrack telemetry"
        >
          ↻ Re-sync Hardware State
        </button>
      </div>

      {/* Section 1: Remote Controlling Actions */}
      <div className={styles.settingSection}>
        <div className={styles.sectionHeader}>
          <h3>Robotic Actuator & Cross-Connect Controls</h3>
          <span
            className={styles.guardBadge}
            style={
              safety && !safety.isSafe
                ? { background: "rgba(239, 68, 68, 0.2)", color: "#f87171", borderColor: "rgba(239, 68, 68, 0.4)" }
                : {}
            }
          >
            {safety && !safety.isSafe ? `⚠️ INTERLOCK ENGAGED (${safety.stateLabel})` : "CONTROLLER ARMED & CALIBRATED"}
          </span>
        </div>

        {safety && !safety.isSafe && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              borderRadius: 4,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 18 }}>🔒</span>
            <div>
              <strong style={{ color: "#ef4444", fontSize: 12, textTransform: "uppercase" }}>Safety Interlock Active</strong>
              <p style={{ margin: "2px 0 0 0", color: "#fca5a5", fontSize: 12 }}>
                {safety.interlockReason}
              </p>
            </div>
          </div>
        )}

        <div className={styles.controlGrid}>
          {/* Card 1: Provision Cross-Connect */}
          <div className={styles.controlActionCard}>
            <div>
              <h4>Provision New Optical Cross-Connect</h4>
              <p>
                Dispatch an instruction to the 3-axis internal robotic actuator to physically align and mate two available LC/APC simplex or duplex optical ports.
              </p>
              <div style={{ marginTop: 12, padding: "8px 12px", background: "#060a12", border: "1px solid #162238", borderRadius: 3, fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: "#64748b" }}>
                <span>Optical Spec: SMF-28e Ultra · IL Budget: &lt; 0.40 dB · Return Loss: &gt; 55 dB</span>
              </div>
            </div>
            <button
              type="button"
              className={styles.primaryDispatchBtn}
              onClick={onOpenConnectModal}
              disabled={(safety && !safety.isSafe) || readOnly}
              style={
                (safety && !safety.isSafe) || readOnly
                  ? { width: "100%", justifyContent: "center", marginTop: 16, padding: "10px 16px", background: "#1e293b", color: "#64748b", cursor: "not-allowed", border: "1px solid #334155" }
                  : { width: "100%", justifyContent: "center", marginTop: 16, padding: "10px 16px" }
              }
            >
              {readOnly
                ? "🔒 Mode Read-Only (Dispatch Dinonaktifkan)"
                : safety && !safety.isSafe
                ? "🔒 Actuator Interlocked (Dispatch Locked)"
                : "Open Cross-Connect Dispatch Form"}
            </button>
          </div>

          {/* Card 2: De-provision Active Circuit */}
          <div className={styles.controlActionCard}>
            <div>
              <h4>De-provision Active Optical Circuit</h4>
              <p>
                Safely disengage and park a physical optical cross-link from the active switch matrix with actuator safety interlock.
              </p>
              {connections.length === 0 ? (
                <div className={styles.emptyNotice} style={{ marginTop: 14 }}>
                  No active cross-connect circuits currently patched in the matrix.
                </div>
              ) : (
                <div className={styles.activeConnPicker} style={{ marginTop: 12 }}>
                  {connections.slice(0, 5).map((c) => {
                    const srcKey = `${c.source[0]?.panel_name}#${c.source[0]?.port_no}`;
                    const p = ports[srcKey];
                    return (
                      <div key={c.connection_id} className={styles.pickerRow}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: "#38bdf8", fontWeight: 600 }}>#{c.connection_id}</span>
                          <span style={{ color: "#cbd5e1" }}>
                            P-{c.source[0]?.port_no} ━━► P-{c.target[0]?.port_no}
                          </span>
                        </div>
                        <button
                          type="button"
                          className={styles.pickerDisconnectBtn}
                          disabled={(safety && !safety.isSafe) || readOnly}
                          style={
                            (safety && !safety.isSafe) || readOnly
                              ? { background: "#1e293b", color: "#64748b", cursor: "not-allowed", borderColor: "#334155" }
                              : {}
                          }
                          onClick={() => {
                            if (!readOnly) {
                              if (onOpenDisconnectConnectionModal) {
                                onOpenDisconnectConnectionModal(c);
                              } else if (p) {
                                onOpenDisconnectModal(p);
                              }
                            }
                          }}
                        >
                          {readOnly ? "🔒 Read-Only" : safety && !safety.isSafe ? "🔒 Locked" : "De-provision (API 2.3)"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Hardware Inventory Subrack */}
      <div className={styles.settingSection}>
        <div className={styles.sectionHeader}>
          <h3>Registered Subrack & Hardware Inventory</h3>
          <span className={styles.statSubtext}>Telecommunications Grade Chassis</span>
        </div>

        {inventory.length === 0 ? (
          <div className={styles.inventoryGrid}>
            <div className={styles.inventoryCard}>
              <div className={styles.inventoryHead}>
                <h4>XSOS-576D Chassis</h4>
                <span className={styles.guardBadge}>ONLINE (SANDBOX)</span>
              </div>
              <div className={styles.inventoryBody}>
                <div className={styles.kvGrid}>
                  <div className={styles.kvItem}>
                    <span className={styles.kvKey}>Chassis Serial</span>
                    <span className={styles.kvVal}>S202120501006</span>
                  </div>
                  <div className={styles.kvItem}>
                    <span className={styles.kvKey}>Subrack Model</span>
                    <span className={styles.kvVal}>XSOS-576D (4RU)</span>
                  </div>
                  <div className={styles.kvItem}>
                    <span className={styles.kvKey}>Firmware Revision</span>
                    <span className={styles.kvVal}>v1.0.0 (MCU-RevD)</span>
                  </div>
                  <div className={styles.kvItem}>
                    <span className={styles.kvKey}>NMS Daemon Rev</span>
                    <span className={styles.kvVal}>v2.0.0.2</span>
                  </div>
                  <div className={styles.kvItem}>
                    <span className={styles.kvKey}>Optical Capacity</span>
                    <span className={styles.kvVal}>576 Ports (288 Duplex)</span>
                  </div>
                  <div className={styles.kvItem}>
                    <span className={styles.kvKey}>Power Feeds</span>
                    <span className={styles.kvVal} style={{ color: "#34d399" }}>
                      Dual -48V DC (A+B OK)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.inventoryGrid}>
            {inventory.map((item, idx) => (
              <div key={item.serial_no || idx} className={styles.inventoryCard}>
                <div className={styles.inventoryHead}>
                  <h4>{item.name || item.model_name || "XSOS Optical Chassis"}</h4>
                  <span
                    className={styles.guardBadge}
                    style={
                      item.alarm_msg
                        ? { background: "rgba(239, 68, 68, 0.25)", color: "#f87171", border: "1px solid #ef4444" }
                        : item.status?.toLowerCase().includes("operat")
                        ? { background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", border: "1px solid #f59e0b" }
                        : item.status?.toLowerCase().includes("lock")
                        ? { background: "rgba(239, 68, 68, 0.2)", color: "#f87171", border: "1px solid #ef4444" }
                        : { background: "rgba(16, 185, 129, 0.15)", color: "#34d399", border: "1px solid #10b981" }
                    }
                  >
                    {item.alarm_msg ? "ALARM ACTIVE" : (item.status ? item.status.toUpperCase() : "READY")}
                  </span>
                </div>
                {item.alarm_msg && (
                  <div style={{ margin: "10px 14px", padding: "8px 12px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: 3, color: "#fca5a5", fontSize: 11, fontFamily: "var(--font-mono, monospace)" }}>
                    🚨 HARDWARE ALARM: {item.alarm_msg}
                  </div>
                )}
                {item.progress && (
                  <div style={{ margin: "10px 14px", padding: "8px 12px", background: "rgba(245, 158, 11, 0.12)", border: "1px solid #f59e0b", borderRadius: 3, color: "#fbbf24", fontSize: 11, fontFamily: "var(--font-mono, monospace)" }}>
                    ⚙️ ROBOTIC MOTION: {item.progress} in progress
                  </div>
                )}
                <div className={styles.inventoryBody}>
                  <div className={styles.kvGrid}>
                    <div className={styles.kvItem}>
                      <span className={styles.kvKey}>Serial Number</span>
                      <span className={styles.kvVal}>{item.serial_no || "—"}</span>
                    </div>
                    <div className={styles.kvItem}>
                      <span className={styles.kvKey}>IP Management</span>
                      <span className={styles.kvVal}>{item.ip_address || "10.200.1.10"}</span>
                    </div>
                    <div className={styles.kvItem}>
                      <span className={styles.kvKey}>Firmware Version</span>
                      <span className={styles.kvVal}>{item.firmware_version || "1.0.0"}</span>
                    </div>
                    <div className={styles.kvItem}>
                      <span className={styles.kvKey}>Software Version</span>
                      <span className={styles.kvVal}>{item.software_version || "2.0.0.2"}</span>
                    </div>
                    <div className={styles.kvItem}>
                      <span className={styles.kvKey}>System Uptime</span>
                      <span className={styles.kvVal}>{item.uptime || "14d 6h 32m"}</span>
                    </div>
                    <div className={styles.kvItem}>
                      <span className={styles.kvKey}>Timezone</span>
                      <span className={styles.kvVal}>{item.timezone || "Asia/Jakarta (UTC+7)"}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Telemetry Gateway & Network Parameters */}
      <div className={styles.settingSection} style={{ marginBottom: 0 }}>
        <div className={styles.sectionHeader}>
          <h3>NOC Gateway & REST API Architecture</h3>
          <span className={styles.statSubtext}>3-Layer Integration Architecture</span>
        </div>

        <div className={styles.inventoryCard}>
          <div className={styles.inventoryBody}>
            <div className={styles.kvGrid} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>Layer 1: Frontend NOC Console</span>
                <span className={styles.kvVal}>Next.js 14 App Router (:3000)</span>
              </div>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>Layer 2: Local Proxy Daemon</span>
                <span className={styles.kvVal}>FastAPI Python Daemon (:8005)</span>
              </div>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>Layer 3: Target Xenoptics Endpoint</span>
                <span className={styles.kvVal} style={{ color: "#38bdf8" }}>
                  https://nms2-sandbox.xenoptics.co/api/v2
                </span>
              </div>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>Authentication Method</span>
                <span className={styles.kvVal}>Bearer Token / Cookie Session</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
