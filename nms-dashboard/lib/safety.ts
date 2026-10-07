import type { InventoryItem, SystemStatus } from "@/types/nms";

export type RoboticState =
  | "ready"
  | "operating"
  | "locked"
  | "locking"
  | "unlocking"
  | "initializing"
  | "recovery"
  | "paused"
  | "standby"
  | "alarm";

export interface SafetyAssessment {
  isSafe: boolean;
  state: RoboticState;
  stateLabel: string;
  activeAlarms: string[];
  interlockReason: string | null;
  progressPercent: number | null;
  unitStatuses: Array<{
    name: string;
    serialNo: string;
    status: string;
    progress: string | null;
    alarm: string | null;
  }>;
}

/**
 * Mengevaluasi kelayakan keselamatan operasional sakelar optik robotik.
 * Menghalangi eksekusi remote connect/disconnect jika robot sedang bergerak,
 * terkunci, dalam proses recovery, atau ada alarm aktif pada perangkat fisik.
 */
export function evaluateRoboticSafety(
  systemStatus: SystemStatus | null,
  inventory: InventoryItem[]
): SafetyAssessment {
  const isSysPaused = systemStatus?.status?.toLowerCase() === "paused";
  const activeAlarms: string[] = [];

  // 1. Kumpulkan semua alarm aktif dari inventaris unit
  for (const item of inventory) {
    if (item.alarm_msg && item.alarm_msg.trim()) {
      activeAlarms.push(`${item.name || item.model_name || "Chassis"}: ${item.alarm_msg}`);
    }
  }

  // Notifikasi sistem jika ada
  if ((systemStatus?.total_notification ?? 0) > 0 && activeAlarms.length === 0) {
    // Info notifikasi dari sistem
  }

  let worstState: RoboticState = "ready";
  let interlockReason: string | null = null;
  let progressPercent: number | null = null;

  if (activeAlarms.length > 0) {
    worstState = "alarm";
    interlockReason = `Active Hardware Alarm: ${activeAlarms[0]}`;
  } else if (isSysPaused) {
    worstState = "paused";
    interlockReason = "NMS System status is PAUSED. Optical actuator motors are offline.";
  }

  // 2. Evaluasi status masing-masing sasis XSOS
  for (const item of inventory) {
    const rawStatus = (item.status || "Ready").trim();
    const s = rawStatus.toLowerCase().replace(/[\s-_]/g, "");

    // Cek progress jika ada
    if (item.progress) {
      const match = item.progress.match(/(\d+)/);
      if (match) {
        progressPercent = parseInt(match[1], 10);
      }
    }

    if (s.includes("operat")) {
      if (worstState !== "alarm") {
        worstState = "operating";
        interlockReason = `Robotic actuator on ${item.name || "chassis"} is currently MOVING (${item.progress || "In-motion"}).`;
      }
    } else if (s.includes("lock")) {
      if (worstState !== "alarm" && worstState !== "operating") {
        worstState = "locked";
        interlockReason = `Optical subrack actuator on ${item.name || "chassis"} is LOCKED / PARKED.`;
      }
    } else if (s.includes("recov")) {
      if (worstState !== "alarm") {
        worstState = "recovery";
        interlockReason = `Subrack on ${item.name || "chassis"} is in FAULT RECOVERY sequence.`;
      }
    } else if (s.includes("init")) {
      if (worstState !== "alarm") {
        worstState = "initializing";
        interlockReason = `Optical matrix subrack is INITIALIZING actuator calibration.`;
      }
    } else if (s.includes("pause")) {
      if (worstState !== "alarm") {
        worstState = "paused";
        interlockReason = `Subrack on ${item.name || "chassis"} is PAUSED by system administrator.`;
      }
    } else if (s.includes("standby") || s.includes("power")) {
      if (worstState === "ready") {
        worstState = "standby";
        interlockReason = `Subrack is in STANDBY / POWER SAVER mode.`;
      }
    }
  }

  const isSafe = worstState === "ready" && activeAlarms.length === 0;

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

  return {
    isSafe,
    state: worstState,
    stateLabel: stateLabels[worstState] || "UNKNOWN",
    activeAlarms,
    interlockReason: isSafe ? null : (interlockReason || "Robotic interlock engaged"),
    progressPercent,
    unitStatuses: inventory.map((i) => ({
      name: i.name || i.model_name || "XSOS Chassis",
      serialNo: i.serial_no || "—",
      status: i.status || "Ready",
      progress: i.progress || null,
      alarm: i.alarm_msg || null,
    })),
  };
}
