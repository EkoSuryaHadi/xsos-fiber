"use client";

import { useState } from "react";
import styles from "./NmsDashboard.module.css";
import type { SafetyAssessment, RoboticState } from "@/lib/safety";

interface SafetyBannerProps {
  safety: SafetyAssessment;
  mode: "live" | "demo";
  onSimulateState?: (state: RoboticState, customMsg?: string, progress?: string | null) => void;
  onResetSimulation?: () => void;
  isSimulated?: boolean;
}

export default function SafetyBanner({
  safety,
  mode,
  onSimulateState,
  onResetSimulation,
  isSimulated = false,
}: SafetyBannerProps) {
  const [showSimControls, setShowSimControls] = useState(false);

  const getBannerClass = () => {
    switch (safety.state) {
      case "alarm":
        return styles.safetyBannerAlarm;
      case "operating":
        return styles.safetyBannerOperating;
      case "locked":
      case "locking":
      case "unlocking":
      case "recovery":
      case "paused":
        return styles.safetyBannerLocked;
      default:
        return styles.safetyBannerReady;
    }
  };

  return (
    <div className={`${styles.safetyBannerWrapper} ${getBannerClass()}`}>
      <div className={styles.safetyBannerContent}>
        {/* State Icon & Indicator */}
        <div className={styles.safetyIconCluster}>
          {safety.state === "alarm" && (
            <span className={styles.safetyIconAlert}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
          )}

          {safety.state === "operating" && (
            <span className={styles.safetyIconOperating}>
              <span className={styles.pulseRing} />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={styles.spinIcon}>
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
              </svg>
            </span>
          )}

          {(safety.state === "locked" || safety.state === "locking" || safety.state === "recovery" || safety.state === "paused") && (
            <span className={styles.safetyIconLocked}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
          )}

          {safety.state === "ready" && (
            <span className={styles.safetyIconReady}>
              <span className={styles.ledPinGreen} style={{ width: 8, height: 8 }} />
            </span>
          )}
        </div>

        {/* Text information */}
        <div className={styles.safetyTextCluster}>
          <div className={styles.safetyTitleRow}>
            <span className={styles.safetyStateBadge}>{safety.stateLabel}</span>
            <span className={styles.safetyInterlockStatus}>
              {safety.isSafe ? "INTERLOCK DISARMED · DISPATCH PERMITTED" : "INTERLOCK ENGAGED · REMOTE ACTIONS BLOCKED"}
            </span>
            {isSimulated && <span className={styles.safetySimTag}>[SIMULATION ACTIVE]</span>}
          </div>

          <p className={styles.safetyDetailText}>
            {safety.isSafe
              ? "All internal robotic chassis, 3-axis actuators, and optical matrices are calibrated and ready for cross-connect instructions."
              : safety.interlockReason}
          </p>

          {/* Progress bar if operating */}
          {safety.state === "operating" && (
            <div className={styles.safetyProgressContainer}>
              <div className={styles.safetyProgressBar}>
                <div
                  className={styles.safetyProgressFill}
                  style={{ width: `${safety.progressPercent ?? 45}%` }}
                />
              </div>
              <span className={styles.safetyProgressLabel}>
                {safety.progressPercent ? `${safety.progressPercent}% Completed` : "Actuator Motor Mating Port"}
              </span>
            </div>
          )}
        </div>

        {/* Safety Actions & Diagnostic Simulation */}
        <div className={styles.safetyRightControls}>
          <button
            type="button"
            className={styles.safetyToggleBtn}
            onClick={() => setShowSimControls((prev) => !prev)}
            title="Inspect robotic subrack interlocks & test fault scenarios"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Safety Diagnostics
            <span>{showSimControls ? "▲" : "▼"}</span>
          </button>
        </div>
      </div>

      {/* Expanded Safety Interlock Testing Panel */}
      {showSimControls && (
        <div className={styles.safetySimDrawer}>
          <div className={styles.safetySimHeader}>
            <span>NOC Hardware Safety Guard & Interlock Verification Console</span>
            <span className={styles.safetySimSub}>
              Test how remote dispatch buttons are hardware-isolated during abnormal mechanical or optical states.
            </span>
          </div>

          <div className={styles.safetySimButtonGroup}>
            <button
              type="button"
              className={`${styles.simStateBtn} ${safety.state === "ready" ? styles.simStateBtnActive : ""}`}
              onClick={() => onResetSimulation?.()}
            >
              <span className={styles.ledPinGreen} style={{ width: 6, height: 6 }} />
              State: Normal Ready
            </button>

            <button
              type="button"
              className={`${styles.simStateBtn} ${safety.state === "operating" ? styles.simStateBtnActiveAmber : ""}`}
              onClick={() => onSimulateState?.("operating", "Robotic Arm actively mating LC fiber core.", "65%")}
            >
              <span className={styles.ledPinAmber} style={{ width: 6, height: 6 }} />
              Simulate: Actuator In-Motion (65%)
            </button>

            <button
              type="button"
              className={`${styles.simStateBtn} ${safety.state === "locked" ? styles.simStateBtnActiveLocked : ""}`}
              onClick={() => onSimulateState?.("locked", "Chassis XSOS-576D-1 subrack actuator parked & locked.")}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Simulate: Actuator Locked
            </button>

            <button
              type="button"
              className={`${styles.simStateBtn} ${safety.state === "alarm" ? styles.simStateBtnActiveRed : ""}`}
              onClick={() => onSimulateState?.("alarm", "ALARM-03: S-Axis Lead Screw Motor Current Spike Exceeded Threshold")}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
              Simulate: Critical Hardware Alarm
            </button>

            <button
              type="button"
              className={`${styles.simStateBtn} ${safety.state === "recovery" ? styles.simStateBtnActiveLocked : ""}`}
              onClick={() => onSimulateState?.("recovery", "System in automated fault recovery sequence after power cycle.")}
            >
              Simulate: Recovery Mode
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
