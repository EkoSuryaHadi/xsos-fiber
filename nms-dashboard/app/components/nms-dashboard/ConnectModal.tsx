"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./NmsDashboard.module.css";
import { PANELS, PORTS_PER_PANEL } from "@/lib/mock-nms-data";
import type { Port } from "@/types/nms";
import type { SafetyAssessment } from "@/lib/safety";

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  ports: Record<string, Port>;
  panels?: string[];
  initialSource?: { panel: string; port: number } | null;
  safety?: SafetyAssessment;
  readOnly?: boolean;
  onConnect: (params: {
    source_panel_name: string;
    source_port_no: number[];
    target_panel_name: string;
    target_port_no: number[];
    route?: number;
    start_date?: string;
    customer?: string;
  }) => Promise<void>;
}

function parseErrorMessage(err: unknown): string {
  if (!err) return "Terjadi kesalahan saat memproses koneksi.";
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}$/);
    if (jsonMatch) {
      let parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.detail === "string") {
        try {
          parsed = JSON.parse(parsed.detail);
        } catch {
          // ignore
        }
      }
      if (parsed.details) return String(parsed.details);
      if (parsed.message) return String(parsed.message);
      if (parsed.detail) return String(parsed.detail);
    }
  } catch {
    // fallback
  }
  return raw;
}

export default function ConnectModal({
  isOpen,
  onClose,
  ports,
  panels,
  initialSource,
  safety,
  readOnly = false,
  onConnect,
}: ConnectModalProps) {
  const availablePanels = useMemo(() => {
    if (panels && panels.length > 0) return panels;
    const s = new Set<string>();
    Object.values(ports).forEach((p) => {
      if (p.panel_name) s.add(p.panel_name);
    });
    return s.size > 0 ? Array.from(s).sort() : PANELS;
  }, [panels, ports]);

  // Mode: single (1 port) vs batch (Ribbon / Trunk continuous block)
  const [connectMode, setConnectMode] = useState<"single" | "batch">("single");

  // Single mode state
  const [sourcePanel, setSourcePanel] = useState(initialSource?.panel || availablePanels[0] || "XSOS-576D-1");
  const [sourcePort, setSourcePort] = useState<number>(initialSource?.port || 1);
  const [targetPanel, setTargetPanel] = useState(availablePanels[1] || availablePanels[0] || "XSOS-576D-1");
  const [targetPort, setTargetPort] = useState<number>(145);

  // Batch mode state
  const [batchSourcePanel, setBatchSourcePanel] = useState(initialSource?.panel || availablePanels[0] || "XSOS-576D-1");
  const [batchSourceStart, setBatchSourceStart] = useState<number>(initialSource?.port || 1);
  const [batchTargetPanel, setBatchTargetPanel] = useState(availablePanels[1] || availablePanels[0] || "XSOS-576D-1");
  const [batchTargetStart, setBatchTargetStart] = useState<number>(145);
  const [batchSize, setBatchSize] = useState<number>(4);

  // Shared options
  const [routeStrategy, setRouteStrategy] = useState<number>(0); // 0: Auto, 1: Tray A, 2: Tray B
  const [customerTag, setCustomerTag] = useState<string>("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Available ports for source & target in single mode
  const availableSourcePorts = useMemo(() => {
    return Object.values(ports)
      .filter((p) => p.panel_name === sourcePanel && p.status === "Available")
      .map((p) => p.port_no)
      .sort((a, b) => a - b);
  }, [ports, sourcePanel]);

  const availableTargetPorts = useMemo(() => {
    return Object.values(ports)
      .filter(
        (p) =>
          p.panel_name === targetPanel &&
          p.status === "Available" &&
          !(sourcePanel === targetPanel && p.port_no === sourcePort)
      )
      .map((p) => p.port_no)
      .sort((a, b) => a - b);
  }, [ports, targetPanel, sourcePanel, sourcePort]);

  // Compute batch preview pairs & validation
  const batchPairs = useMemo(() => {
    if (connectMode !== "batch") return [];
    const pairs: Array<{
      index: number;
      srcPort: number;
      srcStatus: "Available" | "Connected" | "Reserved" | "OutOfRange";
      srcMsg?: string;
      tgtPort: number;
      tgtStatus: "Available" | "Connected" | "Reserved" | "OutOfRange";
      tgtMsg?: string;
      valid: boolean;
    }> = [];

    for (let i = 0; i < batchSize; i++) {
      const sp = batchSourceStart + i;
      const tp = batchTargetStart + i;

      let srcStatus: "Available" | "Connected" | "Reserved" | "OutOfRange" = "Available";
      let srcMsg: string | undefined;
      if (sp < 1 || sp > PORTS_PER_PANEL) {
        srcStatus = "OutOfRange";
        srcMsg = `Exceeds max (${PORTS_PER_PANEL})`;
      } else {
        const portObj = ports[`${batchSourcePanel}#${sp}`];
        if (portObj) {
          if (portObj.status === "Connected") {
            srcStatus = "Connected";
            srcMsg = `Active to P-${portObj.connected_port}`;
          } else if (portObj.reserved_as_interconnection) {
            srcStatus = "Reserved";
            srcMsg = "Interconnection Tie";
          }
        }
      }

      let tgtStatus: "Available" | "Connected" | "Reserved" | "OutOfRange" = "Available";
      let tgtMsg: string | undefined;
      if (tp < 1 || tp > PORTS_PER_PANEL) {
        tgtStatus = "OutOfRange";
        tgtMsg = `Exceeds max (${PORTS_PER_PANEL})`;
      } else if (batchSourcePanel === batchTargetPanel && sp === tp) {
        tgtStatus = "Connected";
        tgtMsg = "Cannot loopback to self";
      } else {
        const portObj = ports[`${batchTargetPanel}#${tp}`];
        if (portObj) {
          if (portObj.status === "Connected") {
            tgtStatus = "Connected";
            tgtMsg = `Active to P-${portObj.connected_port}`;
          } else if (portObj.reserved_as_interconnection) {
            tgtStatus = "Reserved";
            tgtMsg = "Interconnection Tie";
          }
        }
      }

      const valid = srcStatus === "Available" && tgtStatus === "Available";
      pairs.push({
        index: i + 1,
        srcPort: sp,
        srcStatus,
        srcMsg,
        tgtPort: tp,
        tgtStatus,
        tgtMsg,
        valid,
      });
    }

    return pairs;
  }, [
    connectMode,
    batchSize,
    batchSourceStart,
    batchSourcePanel,
    batchTargetStart,
    batchTargetPanel,
    ports,
  ]);

  const batchHasInvalid = useMemo(() => {
    return batchPairs.some((p) => !p.valid);
  }, [batchPairs]);

  // Sync state whenever modal opens or initial source changes
  useEffect(() => {
    if (isOpen) {
      const validSrc =
        initialSource?.panel && availablePanels.includes(initialSource.panel)
          ? initialSource.panel
          : availablePanels[0] || "XSOS-576D-1";
      setSourcePanel(validSrc);
      setBatchSourcePanel(validSrc);
      setTargetPanel(availablePanels[1] || validSrc);
      setBatchTargetPanel(availablePanels[1] || validSrc);
      if (initialSource?.port) {
        setSourcePort(initialSource.port);
        setBatchSourceStart(initialSource.port);
      }
      setErrorMsg(null);
    }
  }, [isOpen, initialSource, availablePanels]);

  useEffect(() => {
    if (availablePanels.length > 0 && !availablePanels.includes(sourcePanel)) {
      setSourcePanel(availablePanels[0]);
    }
  }, [availablePanels, sourcePanel]);

  useEffect(() => {
    if (availablePanels.length > 0 && !availablePanels.includes(targetPanel)) {
      setTargetPanel(availablePanels[0]);
    }
  }, [availablePanels, targetPanel]);

  useEffect(() => {
    if (availableSourcePorts.length > 0 && !availableSourcePorts.includes(sourcePort)) {
      setSourcePort(availableSourcePorts[0]);
    }
  }, [availableSourcePorts, sourcePort]);

  useEffect(() => {
    if (availableTargetPorts.length > 0 && !availableTargetPorts.includes(targetPort)) {
      setTargetPort(availableTargetPorts[0]);
    }
  }, [availableTargetPorts, targetPort]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setErrorMsg(null);

    let srcArray: number[];
    let tgtArray: number[];
    let sPanel: string;
    let tPanel: string;

    if (connectMode === "single") {
      srcArray = [Number(sourcePort)];
      tgtArray = [Number(targetPort)];
      sPanel = sourcePanel;
      tPanel = targetPanel;
    } else {
      if (batchHasInvalid) {
        setErrorMsg("Beberapa port dalam blok continuous tidak tersedia atau melebihi batas fisik.");
        return;
      }
      srcArray = batchPairs.map((p) => p.srcPort);
      tgtArray = batchPairs.map((p) => p.tgtPort);
      sPanel = batchSourcePanel;
      tPanel = batchTargetPanel;
    }

    setSubmitting(true);

    try {
      await onConnect({
        source_panel_name: sPanel,
        source_port_no: srcArray,
        target_panel_name: tPanel,
        target_port_no: tgtArray,
        route: routeStrategy,
        customer: customerTag.trim() || undefined,
        start_date: isScheduled && scheduledTime ? scheduledTime : undefined,
      });
      onClose();
    } catch (err: unknown) {
      setErrorMsg(parseErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const isLocked = (safety ? !safety.isSafe : false) || readOnly;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>
            <span className={styles.modalIcon}>🔌</span>
            <div>
              <h3>Remote Fiber Cross-Connect Dispatch</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: 11, color: "#94a3b8" }}>
                Xenoptics XSOS Method 2.0 Robotic Matrix Actuator Control
              </p>
            </div>
          </div>
          <button className={styles.drawerClose} onClick={onClose} type="button">
            ✕
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className={styles.modalModeSwitcher}>
          <button
            type="button"
            className={`${styles.modalModeTab} ${connectMode === "single" ? styles.modalModeTabActive : ""}`}
            onClick={() => setConnectMode("single")}
          >
            🔘 Single Port (1:1)
          </button>
          <button
            type="button"
            className={`${styles.modalModeTab} ${connectMode === "batch" ? styles.modalModeTabActive : ""}`}
            onClick={() => setConnectMode("batch")}
          >
            📦 Batch Ribbon / Trunk (Array of Ports)
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          {errorMsg && <div className={styles.errorAlert}>{errorMsg}</div>}

          {/* Read-Only Lock Banner */}
          {readOnly && (
            <div className={styles.readOnlyNotice} style={{ marginBottom: 12 }}>
              <span>🔒 <strong>Mode Read-Only Aktif:</strong> Anda login dalam mode inspeksi (Audit Viewer). Dispatch instruksi sambung fisik dinonaktifkan.</span>
            </div>
          )}

          {/* Safety Interlock Guard Indicator */}
          {safety && !safety.isSafe ? (
            <div className={styles.modalInterlockWarning}>
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
          ) : (
            <div className={styles.modalSafetyReadyPill}>
              <span className={styles.ledPinGreen} style={{ width: 6, height: 6 }} />
              <span>Safety Interlock Disarmed: Robotic actuator matrix armed & ready for dispatch</span>
            </div>
          )}

          {/* ================= SINGLE PORT MODE ================= */}
          {connectMode === "single" && (
            <>
              <div className={styles.previewBox}>
                <div className={styles.previewEndpoint}>
                  <span className={styles.previewLabel}>PORT SUMBER</span>
                  <strong>{sourcePanel}</strong>
                  <span className={styles.portBadge}>Port {sourcePort}</span>
                </div>
                <div className={styles.previewDivider}>
                  <span className={styles.previewArrow}>────────▶</span>
                  <span className={styles.previewRoute}>
                    {routeStrategy === 0 ? "Route 0 (Auto)" : routeStrategy === 1 ? "Path A (Top Tray)" : "Path B (Bottom Tray)"}
                  </span>
                </div>
                <div className={styles.previewEndpoint}>
                  <span className={styles.previewLabel}>PORT TARGET</span>
                  <strong>{targetPanel}</strong>
                  <span className={styles.portBadge}>Port {targetPort}</span>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Panel Sumber (Source Chassis):</label>
                  <select
                    value={sourcePanel}
                    onChange={(e) => {
                      setSourcePanel(e.target.value);
                      setSourcePort(1);
                    }}
                  >
                    {availablePanels.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Port Sumber (Available):</label>
                  <select
                    value={sourcePort}
                    onChange={(e) => setSourcePort(Number(e.target.value))}
                  >
                    {availableSourcePorts.map((no) => (
                      <option key={no} value={no}>
                        Port {no} ({no <= 144 ? "East" : "West"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Panel Target (Target Chassis):</label>
                  <select
                    value={targetPanel}
                    onChange={(e) => {
                      setTargetPanel(e.target.value);
                      setTargetPort(145);
                    }}
                  >
                    {availablePanels.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Port Target (Available):</label>
                  <select
                    value={targetPort}
                    onChange={(e) => setTargetPort(Number(e.target.value))}
                  >
                    {availableTargetPorts.map((no) => (
                      <option key={no} value={no}>
                        Port {no} ({no <= 144 ? "East" : "West"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* ================= BATCH RIBBON / TRUNK MODE ================= */}
          {connectMode === "batch" && (
            <div className={styles.batchSection}>
              {/* Ribbon Presets */}
              <div className={styles.ribbonPresetBar}>
                <span className={styles.fieldLabelSmall}>Ribbon Trunk Size:</span>
                <div className={styles.ribbonButtonGroup}>
                  {[2, 4, 8, 12, 24].map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`${styles.ribbonBtn} ${batchSize === size ? styles.ribbonBtnActive : ""}`}
                      onClick={() => setBatchSize(size)}
                    >
                      {size === 12 ? "12F (MPO)" : size === 24 ? "24F (Trunk)" : `${size} Cores`}
                    </button>
                  ))}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>Custom:</span>
                    <input
                      type="number"
                      min={1}
                      max={48}
                      value={batchSize}
                      onChange={(e) => setBatchSize(Math.max(1, Math.min(48, Number(e.target.value))))}
                      style={{ width: 50, padding: "3px 6px", fontSize: 11 }}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Panel Sumber (Source):</label>
                  <select
                    value={batchSourcePanel}
                    onChange={(e) => setBatchSourcePanel(e.target.value)}
                  >
                    {availablePanels.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Mulai Port Sumber (P-Start):</label>
                  <input
                    type="number"
                    min={1}
                    max={PORTS_PER_PANEL - batchSize + 1}
                    value={batchSourceStart}
                    onChange={(e) => setBatchSourceStart(Number(e.target.value))}
                  />
                  <span className={styles.fieldHelper}>
                    Rentang: P-{batchSourceStart} .. P-{batchSourceStart + batchSize - 1}
                  </span>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Panel Target (Target):</label>
                  <select
                    value={batchTargetPanel}
                    onChange={(e) => setBatchTargetPanel(e.target.value)}
                  >
                    {availablePanels.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Mulai Port Target (P-Start):</label>
                  <input
                    type="number"
                    min={1}
                    max={PORTS_PER_PANEL - batchSize + 1}
                    value={batchTargetStart}
                    onChange={(e) => setBatchTargetStart(Number(e.target.value))}
                  />
                  <span className={styles.fieldHelper}>
                    Rentang: P-{batchTargetStart} .. P-{batchTargetStart + batchSize - 1}
                  </span>
                </div>
              </div>

              {/* Batch Pairs Live Verification Preview */}
              <div className={styles.batchPairsCard}>
                <div className={styles.batchPairsHeader}>
                  <span style={{ fontWeight: 600, color: "#f8fafc" }}>
                    Continuous Ribbon Pairs Preview ({batchPairs.length} Cores)
                  </span>
                  <span style={{ fontSize: 11, color: batchHasInvalid ? "#ef4444" : "#10b981", fontWeight: 600 }}>
                    {batchHasInvalid ? "⚠️ Konflik Ditemukan" : "✓ Semua Port Valid & Siap"}
                  </span>
                </div>

                <div className={styles.batchPairsList}>
                  {batchPairs.map((pair) => (
                    <div
                      key={pair.index}
                      className={`${styles.batchPairRow} ${pair.valid ? styles.batchPairRowOk : styles.batchPairRowErr}`}
                    >
                      <span className={styles.batchPairIdx}>#{pair.index}</span>
                      <span className={styles.batchPairSrc}>
                        {batchSourcePanel} : P-{pair.srcPort}
                      </span>
                      <span className={styles.batchPairArrow}>──▶</span>
                      <span className={styles.batchPairTgt}>
                        {batchTargetPanel} : P-{pair.tgtPort}
                      </span>
                      <span
                        className={styles.batchPairBadge}
                        style={{
                          color: pair.valid ? "#34d399" : "#f87171",
                          borderColor: pair.valid ? "rgba(52, 211, 153, 0.3)" : "rgba(248, 113, 113, 0.4)",
                        }}
                      >
                        {pair.valid ? "Available ✓" : pair.srcMsg || pair.tgtMsg || "Tidak Valid"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= ROUTING & METADATA SECTION ================= */}
          <div className={styles.formRow} style={{ marginTop: 12 }}>
            <div className={styles.formGroup}>
              <label>Robotic Route Strategy (Doc p. 22):</label>
              <select
                value={routeStrategy}
                onChange={(e) => setRouteStrategy(Number(e.target.value))}
              >
                <option value={0}>0 — Auto Path Optimizer (Recommended)</option>
                <option value={1}>1 — Primary Tray Routing (Direct Path A)</option>
                <option value={2}>2 — Secondary Tray Routing (Direct Path B)</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Customer Allocation / Circuit ID (Optional):</label>
              <input
                type="text"
                placeholder="e.g. TELKOMSEL-100G-01, CLOUDFLARE-IXP"
                value={customerTag}
                onChange={(e) => setCustomerTag(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.scheduleOption}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
              />
              <span>Jadwalkan koneksi untuk waktu tertentu</span>
            </label>

            {isScheduled && (
              <div className={styles.formGroup} style={{ marginTop: 8 }}>
                <label>Waktu Eksekusi Terjadwal:</label>
                <input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  required={isScheduled}
                />
              </div>
            )}
          </div>

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
              type="submit"
              className={styles.submitBtn}
              disabled={submitting || isLocked || (connectMode === "batch" && batchHasInvalid)}
              style={
                isLocked || (connectMode === "batch" && batchHasInvalid)
                  ? { background: "#1e293b", color: "#64748b", cursor: "not-allowed", border: "1px solid #334155" }
                  : {}
              }
            >
              {submitting
                ? "Memproses Perintah…"
                : readOnly
                ? "🔒 Mode Read-Only (Terkunci)"
                : safety && !safety.isSafe
                ? "🔒 Eksekusi Terkunci (Interlock)"
                : connectMode === "batch"
                ? `Sambungkan Batch ${batchSize} Port Sekarang`
                : "Sambungkan Port Sekarang"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
