"use client";

import { useState } from "react";
import styles from "./NmsDashboard.module.css";
import type { ConnectionItem, Port } from "@/types/nms";
import type { SafetyAssessment } from "@/lib/safety";

interface DisconnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  port?: Port | null;
  connection?: ConnectionItem | null;
  safety?: SafetyAssessment;
  readOnly?: boolean;
  onDisconnect?: (panelName: string, portNo: number) => Promise<void>;
  onDisconnectById?: (connectionId: number) => Promise<void>;
}

function parseErrorMessage(err: unknown): string {
  if (!err) return "Terjadi kesalahan saat memproses pemutusan.";
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}$/);
    if (jsonMatch) {
      let parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.detail === "string") {
        try {
          parsed = JSON.parse(parsed.detail);
        } catch {}
      }
      if (parsed.details) return String(parsed.details);
      if (parsed.message) return String(parsed.message);
      if (parsed.detail) return String(parsed.detail);
    }
  } catch {}
  return raw;
}

export default function DisconnectModal({
  isOpen,
  onClose,
  port,
  connection,
  safety,
  readOnly = false,
  onDisconnect,
  onDisconnectById,
}: DisconnectModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || (!port && !connection)) return null;

  const isById = Boolean(connection);
  const isLocked = (safety ? !safety.isSafe : false) || readOnly;

  const handleConfirmDisconnect = async () => {
    if (!confirmed || isLocked) return;
    setErrorMsg(null);
    setSubmitting(true);

    try {
      if (isById && connection && onDisconnectById) {
        await onDisconnectById(connection.connection_id);
      } else if (port && onDisconnect) {
        await onDisconnect(port.panel_name, port.port_no);
      }
      onClose();
    } catch (err: unknown) {
      setErrorMsg(parseErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <div className={styles.modalTitle} style={{ color: "#ff5e7e" }}>
            <span className={styles.modalIcon}>✂️</span>
            <h3>
              {isById
                ? `Konfirmasi Pemutusan Sirkuit #${connection?.connection_id} (API 2.3)`
                : "Konfirmasi Pemutusan Port (Disconnect - API 2.2)"}
            </h3>
          </div>
          <button className={styles.drawerClose} onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {errorMsg && <div className={styles.errorAlert}>{errorMsg}</div>}

          {/* Read-Only Lock Banner */}
          {readOnly && (
            <div className={styles.readOnlyNotice} style={{ marginBottom: 14 }}>
              <span>🔒 <strong>Mode Read-Only Aktif:</strong> Sesi saat ini adalah Audit Viewer. Pemutusan koneksi dinonaktifkan.</span>
            </div>
          )}

          {/* Safety Interlock Guard Indicator */}
          {safety && !safety.isSafe && (
            <div className={styles.modalInterlockWarning} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🔒</span>
                <div>
                  <strong style={{ color: "#ef4444", textTransform: "uppercase", fontSize: 12 }}>
                    Safety Interlock Engaged ({safety.stateLabel})
                  </strong>
                  <p style={{ margin: "2px 0 0 0", color: "#fca5a5", fontSize: 12 }}>
                    {safety.interlockReason}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className={styles.dangerNotice}>
            <div className={styles.dangerIcon}>⚠️</div>
            <div className={styles.dangerText}>
              <strong>Peringatan Keselamatan Jaringan</strong>
              <p>
                {isById
                  ? `Aksi ini akan mencabut cross-connect sirkuit #${connection?.connection_id} dari robotik sakelar XSOS via API 2.3 (Create Disconnection by ID). Semua transmisi data pada sirkuit ini akan terhenti seketika.`
                  : "Aksi ini akan mengirim perintah fisik ke robotik XSOS untuk mencabut cross-connect serat optik. Semua lalu lintas data yang melewati port ini akan terhenti seketika."}
              </p>
            </div>
          </div>

          {isById && connection ? (
            <div className={styles.disconnectTargetCard}>
              <div className={styles.kv}>
                <span className={styles.k}>Connection ID</span>
                <span className={styles.v} style={{ color: "#38bdf8", fontWeight: 700 }}>
                  #{connection.connection_id}
                </span>
              </div>
              <div className={styles.kv}>
                <span className={styles.k}>Sumber (Source)</span>
                <span className={styles.v} style={{ color: "var(--connected)", fontWeight: 600 }}>
                  {connection.source[0]?.panel_name} : Port {connection.source[0]?.port_no}
                  {connection.source[0]?.port_description && ` (${connection.source[0]?.port_description})`}
                </span>
              </div>
              <div className={styles.kv}>
                <span className={styles.k}>Tujuan (Target)</span>
                <span className={styles.v} style={{ color: "var(--connected)", fontWeight: 600 }}>
                  {connection.target[0]?.panel_name} : Port {connection.target[0]?.port_no}
                  {connection.target[0]?.port_description && ` (${connection.target[0]?.port_description})`}
                </span>
              </div>
              <div className={styles.kv}>
                <span className={styles.k}>Created By / Time</span>
                <span className={styles.v}>
                  {connection.created_by || "EMS"} · {connection.created_at || "—"}
                </span>
              </div>
              <div className={styles.kv}>
                <span className={styles.k}>Endpoint API</span>
                <span className={styles.v} style={{ fontFamily: "monospace", fontSize: 11, color: "#a5b4fc" }}>
                  POST /api/v2/connectivity/connections/{connection.connection_id}/disconnect
                </span>
              </div>
            </div>
          ) : port ? (
            <div className={styles.disconnectTargetCard}>
              <div className={styles.kv}>
                <span className={styles.k}>Panel</span>
                <span className={styles.v}>{port.panel_name}</span>
              </div>
              <div className={styles.kv}>
                <span className={styles.k}>Nomor Port</span>
                <span className={styles.v} style={{ color: "var(--connected)", fontWeight: 600 }}>
                  Port {port.port_no} ({port.smu_type})
                </span>
              </div>
              <div className={styles.kv}>
                <span className={styles.k}>Tersambung ke</span>
                <span className={styles.v}>
                  {port.connected_port ? `Port ${port.connected_port}` : "—"}
                </span>
              </div>
              <div className={styles.kv}>
                <span className={styles.k}>Tipe Fiber</span>
                <span className={styles.v}>{port.fiber_type}</span>
              </div>
              {port.allocated_to_customer && (
                <div className={styles.kv}>
                  <span className={styles.k}>Customer Lease</span>
                  <span className={styles.v} style={{ color: "#38bdf8", fontWeight: 600 }}>
                    🏢 {port.allocated_to_customer}
                  </span>
                </div>
              )}
              {port.reserved_as_interconnection && (
                <div className={styles.kv}>
                  <span className={styles.k}>Interconnection</span>
                  <span className={styles.v} style={{ color: "#c084fc", fontWeight: 600 }}>
                    ⇄ Inter-Subrack Tie-Line
                  </span>
                </div>
              )}
            </div>
          ) : null}

          <label className={styles.safetyCheckbox}>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={isLocked}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              {isById && connection ? (
                <>
                  Saya memverifikasi bahwa pemutusan sirkuit <strong>#{connection.connection_id}</strong> (
                  {connection.source[0]?.panel_name} P-{connection.source[0]?.port_no} ──►{" "}
                  {connection.target[0]?.panel_name} P-{connection.target[0]?.port_no}) ini telah disetujui.
                </>
              ) : port ? (
                <>
                  Saya memverifikasi bahwa pemutusan port <strong>{port.panel_name} : Port-{port.port_no}</strong> ini telah disetujui.
                </>
              ) : null}
            </span>
          </label>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={submitting}
            >
              Batal
            </button>
            <button
              type="button"
              className={styles.dangerBtn}
              disabled={!confirmed || submitting || isLocked}
              onClick={handleConfirmDisconnect}
              style={
                isLocked
                  ? { background: "#1e293b", color: "#64748b", cursor: "not-allowed", border: "1px solid #334155" }
                  : {}
              }
            >
              {submitting
                ? "Memutuskan Sirkuit…"
                : readOnly
                ? "🔒 Mode Read-Only (Terkunci)"
                : safety && !safety.isSafe
                ? "🔒 Eksekusi Terkunci (Interlock)"
                : isById
                ? "Putus Sirkuit (API 2.3)"
                : "Putus Koneksi Fisik"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
