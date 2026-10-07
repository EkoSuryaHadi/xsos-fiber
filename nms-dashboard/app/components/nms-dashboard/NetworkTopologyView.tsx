"use client";

import React, { useState, useEffect } from "react";
import styles from "./NetworkTopologyView.module.css";
import type { Port } from "@/types/nms";

interface NetworkTopologyViewProps {
  ports?: Record<string, Port>;
  onSelectPort?: (port: Port) => void;
  onOpenConnect?: () => void;
}

export default function NetworkTopologyView({
  ports = {},
  onSelectPort,
  onOpenConnect,
}: NetworkTopologyViewProps) {
  const [selectedLayer, setSelectedLayer] = useState<"physical" | "logical" | "optical">("physical");
  const [isPathTracing, setIsPathTracing] = useState<boolean>(false);
  const [activeCamPort, setActiveCamPort] = useState<number>(18);
  const [matrixStatus, setMatrixStatus] = useState<"Busy" | "Ready">("Busy");
  const [highlightedFloor, setHighlightedFloor] = useState<string | null>(null);

  // Initial 96 ports pattern matching IXP prototype distribution
  const [matrixPorts, setMatrixPorts] = useState<Array<{ id: number; status: "Connected" | "Available" | "Disabled" }>>(() => {
    return Array.from({ length: 96 }, (_, i) => {
      const portNo = i + 1;
      let status: "Connected" | "Available" | "Disabled" = "Available";
      if (portNo === 25 || portNo === 34 || portNo === 61 || portNo === 89) {
        status = "Disabled";
      } else if (
        portNo % 2 === 0 ||
        portNo % 3 === 0 ||
        (portNo >= 10 && portNo <= 18) ||
        (portNo >= 42 && portNo <= 54)
      ) {
        status = "Connected";
      }
      return { id: portNo, status };
    });
  });

  // Synchronize interactive matrix ports with live ports telemetry
  useEffect(() => {
    if (ports && Object.keys(ports).length > 0) {
      setMatrixPorts((prev) =>
        prev.map((item) => {
          const p = ports[`XSOS-576D-1#${item.id}`] || Object.values(ports).find((x) => x.port_no === item.id);
          if (p) {
            return {
              id: item.id,
              status: p.status === "Connected" ? "Connected" : p.status === "Disabled" ? "Disabled" : "Available",
            };
          }
          return item;
        })
      );
    }
  }, [ports]);

  // Toggle Busy / Ready periodically or upon interaction to give authentic robotic feel
  useEffect(() => {
    const timer = setTimeout(() => {
      setMatrixStatus("Ready");
    }, 2400);
    return () => clearTimeout(timer);
  }, []);

  const handleToggleTrace = () => {
    setIsPathTracing((prev) => !prev);
  };

  const handlePortClick = (portNo: number) => {
    setActiveCamPort(portNo);
    setMatrixStatus("Busy");
    setTimeout(() => setMatrixStatus("Ready"), 1200);

    if (onSelectPort) {
      const key = `XSOS-576D-1#${portNo}`;
      const found = ports[key] || {
        id: `P-${portNo}`,
        panel_name: "XSOS-576D-1",
        port_no: portNo,
        status: "Connected",
        fiber_type: "Singlemode G.657.A1",
        inserted_loss_db: 0.32,
      };
      onSelectPort(found as Port);
    }
  };

  return (
    <div className={styles.container}>
      {/* ====================================================================
          1. TOP TOOL ROW
          ==================================================================== */}
      <div className={styles.toolrow}>
        <div className={styles.toolgroup}>
          <button
            type="button"
            className={`${styles.chip} ${selectedLayer === "physical" ? styles.chipActive : ""}`}
            onClick={() => setSelectedLayer("physical")}
          >
            Physical — Dark Fiber
          </button>
          <button
            type="button"
            className={`${styles.chip} ${selectedLayer === "logical" ? styles.chipActive : ""}`}
            onClick={() => setSelectedLayer("logical")}
          >
            Logical — SD-WAN Tunnels
          </button>
          <button
            type="button"
            className={`${styles.chip} ${selectedLayer === "optical" ? styles.chipActive : ""}`}
            onClick={() => setSelectedLayer("optical")}
          >
            Optical — DWDM Channels
          </button>
        </div>

        <div className={styles.toolgroup}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnOutline} ${isPathTracing ? styles.chipActive : ""}`}
            onClick={handleToggleTrace}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            Path Trace
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnNavy}`}
            onClick={onOpenConnect}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <path d="M4 10h16M10 4v16" />
            </svg>
            Manual Override
          </button>
        </div>
      </div>

      {/* ====================================================================
          2. MAIN CARDS ROW (FLOOR MAP + ROBOTIC MATRIX)
          ==================================================================== */}
      <div className={styles.row}>
        {/* Left: Physical Cabling Plan Card */}
        <div className={`${styles.card} ${styles.col2}`}>
          <div className={styles.cardHead}>
            <div>
              <div className={styles.cardTitle}>Existing Data Center — Physical Cabling Plan</div>
              <div className={styles.cardSub}>
                IXP fabric hosted in MMR-A / MMR-B · markers show deployed XSOS-576D units
              </div>
            </div>
            <div className={styles.legend}>
              <div className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: "#0ca30c" }} />
                <span>Nominal</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: "#fab219" }} />
                <span>Degraded</span>
              </div>
            </div>
          </div>

          <div className={styles.cardBody} style={{ padding: "16px 18px", overflow: "hidden" }}>
            <svg
              viewBox="0 0 620 330"
              style={{ width: "100%", height: "auto", display: "block" }}
              aria-label="Data Center Facility Cabling Floor Plan"
            >
              {/* --- 5th Floor: Data Hall (Zone B) --- */}
              <g
                className={styles.floorInteractive}
                onClick={() => setHighlightedFloor(highlightedFloor === "5th" ? null : "5th")}
              >
                <rect
                  x="20"
                  y="8"
                  width="580"
                  height="46"
                  rx="4"
                  fill={highlightedFloor === "5th" ? "#DCF1C5" : "#EAF3DC"}
                  stroke="#8BC53E"
                  strokeWidth={highlightedFloor === "5th" ? "2.2" : "1.5"}
                />
                <text x="30" y="27" fontSize="11" fill="#3E6B12" fontWeight="700" fontFamily="IBM Plex Sans, sans-serif">
                  5th Floor — Data Hall (Zone B) — MMR-A / MMR-B
                </text>
                <text x="30" y="43" fontSize="9.5" fill="#5C6B7A" fontFamily="IBM Plex Sans, sans-serif">
                  Distribution to racks: 276 fibers per MMR
                </text>
              </g>

              {/* --- 3rd - 4th Floor: Space for Future Expansion --- */}
              <rect x="20" y="62" width="580" height="40" rx="4" fill="#FBFBFC" stroke="#E2E6EB" strokeWidth="1" />
              <text x="30" y="86" fontSize="11" fill="#B7BEC5" fontWeight="600" fontFamily="IBM Plex Sans, sans-serif">
                3rd — 4th Floor — Space for Future Expansion
              </text>

              {/* --- 2nd Floor: Data Hall (Zone A) --- */}
              <g
                className={styles.floorInteractive}
                onClick={() => setHighlightedFloor(highlightedFloor === "2nd" ? null : "2nd")}
              >
                <rect
                  x="20"
                  y="110"
                  width="580"
                  height="46"
                  rx="4"
                  fill={highlightedFloor === "2nd" ? "#DCF1C5" : "#EAF3DC"}
                  stroke="#8BC53E"
                  strokeWidth={highlightedFloor === "2nd" ? "2.2" : "1.5"}
                />
                <text x="30" y="129" fontSize="11" fill="#3E6B12" fontWeight="700" fontFamily="IBM Plex Sans, sans-serif">
                  2nd Floor — Data Hall (Zone A) — MMR-A / MMR-B
                </text>
                <text x="30" y="145" fontSize="9.5" fill="#5C6B7A" fontFamily="IBM Plex Sans, sans-serif">
                  IXP peering fabric · distribution to racks: 276 fibers per MMR
                </text>
              </g>

              {/* --- 1st Floor: Office A / Office B --- */}
              <rect x="20" y="164" width="580" height="40" rx="4" fill="#F7F8FA" stroke="#E2E6EB" strokeWidth="1" />
              <text x="30" y="188" fontSize="11" fill="#5C6B7A" fontWeight="600" fontFamily="IBM Plex Sans, sans-serif">
                1st Floor — Office A / Office B
              </text>

              {/* --- Ground Floor: Telecom-A/B Rooms --- */}
              <g
                className={styles.floorInteractive}
                onClick={() => setHighlightedFloor(highlightedFloor === "ground" ? null : "ground")}
              >
                <rect
                  x="20"
                  y="212"
                  width="580"
                  height="52"
                  rx="4"
                  fill={highlightedFloor === "ground" ? "#F0F4F8" : "#FBFBFC"}
                  stroke="#E2E6EB"
                  strokeWidth="1"
                />
                <text x="30" y="232" fontSize="11" fill="#5C6B7A" fontWeight="600" fontFamily="IBM Plex Sans, sans-serif">
                  Ground Floor — Telecom-A/B Rooms · MDF-1 / MDF-2 / MDF-3
                </text>
                <text x="30" y="248" fontSize="9.5" fill="#8B98A5" fontFamily="IBM Plex Sans, sans-serif">
                  288 inbound fibers (3 × 96/MDF) · backbone to MMRs
                </text>
              </g>



              {/* Interconnect Annotation */}
              <text x="285" y="17" fontSize="9" fill="#8B98A5" fontFamily="IBM Plex Sans, sans-serif" textAnchor="end">
                MDF1—MDF3 interconnect: 192 fibers
              </text>
            </svg>
          </div>
        </div>

        {/* Right: XSOS Robotic Cross-Connect Matrix Card */}
        <div className={`${styles.card} ${styles.col1}`}>
          <div className={styles.cardHead}>
            <div>
              <div className={styles.cardTitle}>XSOS Robotic Cross-Connect Matrix</div>
              <div className={`${styles.cardSub} ${styles.mono}`}>
                Unit: XSOS-576D-MMRA-01 · 2nd Floor
              </div>
            </div>
            <span className={`${styles.badge} ${matrixStatus === "Ready" ? styles.badgeGood : styles.badgeWarning}`}>
              {matrixStatus}
            </span>
          </div>

          <div className={styles.cardBody} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* 16x6 = 96 Ports Matrix Grid */}
            <div className={styles.portgrid}>
              {matrixPorts.map((cell) => {
                const bg =
                  cell.status === "Connected"
                    ? "#0ca30c"
                    : cell.status === "Disabled"
                    ? "#9AA5AF"
                    : "#DCE6EF";
                const isSelected = activeCamPort === cell.id;

                return (
                  <div
                    key={cell.id}
                    className={styles.portcell}
                    title={`Port P-${cell.id}: ${cell.status}`}
                    onClick={() => handlePortClick(cell.id)}
                    style={{
                      background: bg,
                      outline: isSelected ? "2px solid #003366" : "none",
                      outlineOffset: "1px",
                    }}
                  />
                );
              })}
            </div>

            {/* Matrix Legend */}
            <div className={styles.legend}>
              <div className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: "#0ca30c" }} />
                <span>Connected</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: "#DCE6EF" }} />
                <span>Available</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: "#9AA5AF" }} />
                <span>Disabled</span>
              </div>
            </div>

            <div className={styles.cardSub} style={{ margin: 0 }}>
              Ports 1–96 of 576 shown · Selected: <strong>P-{activeCamPort}</strong>
            </div>

            {/* Robotic Camera Box View */}
            <div className={styles.cameraBox}>
              <div className={styles.liveTag}>
                <span className={styles.liveDot} />
                LIVE — ROBOTIC UNIT CAM
              </div>
              <svg width="140" height="70" viewBox="0 0 140 70">
                <g stroke="#3CE0C8" strokeWidth="2" fill="none" opacity="0.85">
                  <path d="M10 60 L25 15" />
                  <path d="M28 60 L40 12" />
                  <path d="M46 60 L55 18" />
                  <path d="M64 60 L70 10" />
                  <path d="M82 60 L85 18" />
                  <path d="M100 60 L100 15" />
                  <path d="M118 60 L115 20" />
                  <path d="M132 60 L128 25" />
                </g>
              </svg>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline}`}
                style={{ flex: 1, justifyContent: "center" }}
                onClick={handleToggleTrace}
              >
                Path Trace
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnNavy}`}
                style={{ flex: 1, justifyContent: "center" }}
                onClick={onOpenConnect}
              >
                Reconfigure
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          3. CABLING SUMMARY TABLE CARD
          ==================================================================== */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}>IXP Fiber Plant — Existing Data Center Cabling Summary</div>
            <div className={styles.cardSub} style={{ margin: 0 }}>
              7 × XSOS-576D units deployed · 576 fibers/unit · duplex capability for simultaneous tx/rx
            </div>
          </div>
        </div>
        <div className={styles.cardBody} style={{ padding: 0 }}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Cable Type</th>
                  <th>Route</th>
                  <th>Fiber Count</th>
                  <th>Cable Type</th>
                  <th>Route</th>
                  <th>Fiber Count</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Inbound</td>
                  <td>3× MDF, 96 fibers / MDF</td>
                  <td className={styles.mono}>288</td>
                  <td>Backbone</td>
                  <td>MDF1 — MMR-A (Data Halls)</td>
                  <td className={styles.mono}>96</td>
                </tr>
                <tr>
                  <td>Interconnect</td>
                  <td>MDF1 — MDF3</td>
                  <td className={styles.mono}>192</td>
                  <td>Backbone</td>
                  <td>MDF2 — MMR-A / MMR-B</td>
                  <td className={styles.mono}>96 + 96</td>
                </tr>
                <tr>
                  <td>Interconnect</td>
                  <td>MMR-A — MMR-B (Data Halls)</td>
                  <td className={styles.mono}>24</td>
                  <td>Backbone</td>
                  <td>MDF3 — MMR-B</td>
                  <td className={styles.mono}>96</td>
                </tr>
                <tr>
                  <td>Distribution</td>
                  <td>MMR-A — Racks (Data Hall)</td>
                  <td className={styles.mono}>276</td>
                  <td>Backbone</td>
                  <td>MDF1 / MDF2 — Office A/B</td>
                  <td className={styles.mono}>24 + 24</td>
                </tr>
                <tr>
                  <td>Distribution</td>
                  <td>MMR-B — Racks (Data Hall)</td>
                  <td className={styles.mono}>276</td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
