"use client";

import React, { useState, useEffect, useMemo } from "react";
import styles from "./FaultsEventsView.module.css";
import { fetchOutageIncidents } from "@/lib/business-api";

interface EventItem {
  id: string;
  severity: "Critical" | "Warning" | "Info";
  timestamp: string;
  source: string;
  category: "NetConf" | "Syslog" | "Optical LOS";
  message: string;
  status: "Ack'd" | "Open";
}

interface TicketItem {
  id: string;
  subject: string;
  meta: string;
  status: "Resolved" | "Scheduled" | "In Progress";
}

const INITIAL_EVENTS: EventItem[] = [
  {
    id: "EVT-1001",
    severity: "Warning",
    timestamp: "10:16:29",
    source: "EMS Core",
    category: "Syslog",
    message: "Database sync retry, batch 4412",
    status: "Ack'd",
  },
  {
    id: "EVT-1002",
    severity: "Info",
    timestamp: "10:16:04",
    source: "IXP BoD Controller",
    category: "NetConf",
    message: "New peering session established, AS64512",
    status: "Ack'd",
  },
  {
    id: "EVT-1003",
    severity: "Critical",
    timestamp: "10:16:02",
    source: "XSOS-576D-MMRB-02",
    category: "Optical LOS",
    message: "Loss of signal, Port 214",
    status: "Open",
  },
  {
    id: "EVT-1004",
    severity: "Info",
    timestamp: "10:15:59",
    source: "IXP BoD Controller",
    category: "NetConf",
    message: "New peering session established, AS64512",
    status: "Ack'd",
  },
  {
    id: "EVT-1005",
    severity: "Warning",
    timestamp: "10:15:57",
    source: "EMS Core",
    category: "Syslog",
    message: "Database sync retry, batch 4412",
    status: "Ack'd",
  },
  {
    id: "EVT-1006",
    severity: "Warning",
    timestamp: "10:12:06",
    source: "SDN Controller",
    category: "NetConf",
    message: "Control-plane message delay",
    status: "Ack'd",
  },
  {
    id: "EVT-1007",
    severity: "Info",
    timestamp: "10:09:06",
    source: "IXP BoD Controller",
    category: "NetConf",
    message: "New peering session established, AS64512",
    status: "Ack'd",
  },
  {
    id: "EVT-1008",
    severity: "Info",
    timestamp: "10:07:06",
    source: "MDF-2",
    category: "Syslog",
    message: "Maintenance window scheduled, fiber tray",
    status: "Ack'd",
  },
];

const INITIAL_TICKETS: TicketItem[] = [
  {
    id: "TCK-8842",
    subject: "Optical LOS — Port 214, XSOS-576D-MMRB-02",
    meta: "DC Facilities · Zone B · Window: Today 22:00–00:00",
    status: "Resolved",
  },
  {
    id: "TCK-8839",
    subject: "SDN Controller — API latency investigation",
    meta: "Software Ops Team · Remote · Window: Now",
    status: "Resolved",
  },
  {
    id: "TCK-8831",
    subject: "Fiber tray inspection — MDF-2",
    meta: "DC Facilities · Ground Floor · Closed 11:40",
    status: "Resolved",
  },
  {
    id: "TCK-8827",
    subject: "Module 14 preventive swap — XSOS-576D-MDF2",
    meta: "Field Engineering · Window: Sat 02:00–04:00",
    status: "Resolved",
  },
];

export default function FaultsEventsView() {
  const [activeCategory, setActiveCategory] = useState<"All" | "NetConf" | "Syslog" | "Optical LOS">("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [events, setEvents] = useState<EventItem[]>(INITIAL_EVENTS);
  const [tickets, setTickets] = useState<TicketItem[]>(INITIAL_TICKETS);
  const [isLiveLoaded, setIsLiveLoaded] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadIncidents() {
      try {
        const incidents = await fetchOutageIncidents();
        if (isMounted && incidents && incidents.length > 0) {
          const liveEvents: EventItem[] = incidents.map((inc: any) => ({
            id: inc.id,
            severity: (inc.severity === "Critical" ? "Critical" : inc.severity === "Warning" ? "Warning" : "Info") as "Critical" | "Warning" | "Info",
            timestamp: inc.started_at
              ? new Date(inc.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
              : "Live",
            source: inc.circuit_id || "XSOS-576D-MMRA-01",
            category: "Optical LOS" as const,
            message: inc.root_cause || "Fiber signal degradation detected",
            status: (inc.resolved_at ? "Ack'd" : "Open") as "Ack'd" | "Open",
          }));
          setEvents([...liveEvents, ...INITIAL_EVENTS]);
          setIsLiveLoaded(true);
        }
      } catch (err) {
        console.warn("Using baseline events:", err);
      }
    }
    loadIncidents();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered event log list
  const filteredEvents = useMemo(() => {
    let list = events;
    if (activeCategory !== "All") {
      list = list.filter((e) => e.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.message.toLowerCase().includes(q) ||
          e.source.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.timestamp.toLowerCase().includes(q)
      );
    }
    return list;
  }, [events, activeCategory, searchQuery]);

  return (
    <div className={styles.container}>
      {/* ====================================================================
          1. TOP TOOL ROW & SEARCH BAR
          ==================================================================== */}
      <div className={styles.toolrow}>
        <div className={styles.toolgroup}>
          <button
            type="button"
            className={`${styles.chip} ${activeCategory === "All" ? styles.chipActive : ""}`}
            onClick={() => setActiveCategory("All")}
          >
            All Events
          </button>
          <button
            type="button"
            className={`${styles.chip} ${activeCategory === "NetConf" ? styles.chipActive : ""}`}
            onClick={() => setActiveCategory("NetConf")}
          >
            NetConf Messages
          </button>
          <button
            type="button"
            className={`${styles.chip} ${activeCategory === "Syslog" ? styles.chipActive : ""}`}
            onClick={() => setActiveCategory("Syslog")}
          >
            Syslogs
          </button>
          <button
            type="button"
            className={`${styles.chip} ${activeCategory === "Optical LOS" ? styles.chipActive : ""}`}
            onClick={() => setActiveCategory("Optical LOS")}
          >
            Optical LOS
          </button>
        </div>

        <div className={styles.searchbox}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8B98A5" strokeWidth="2.2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search events, ports, unit IDs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ====================================================================
          2. MAIN ROW: EVENT LOG TABLE & MAINTENANCE TICKETS
          ==================================================================== */}
      <div className={styles.row}>
        {/* Left: Event Log + RCA */}
        <div className={`${styles.card} ${styles.col2}`}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Event Log</div>
            <span className={`${styles.badge} ${styles.badgeNeutral}`}>
              247 events · last 24h
            </span>
          </div>

          <div className={styles.cardBody} style={{ padding: 0 }}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Timestamp</th>
                    <th>Source</th>
                    <th>Category</th>
                    <th>Message</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((e) => {
                    const isCritical = e.severity === "Critical";
                    const isWarning = e.severity === "Warning";
                    const isAcked = e.status === "Ack'd";

                    return (
                      <tr key={e.id}>
                        <td>
                          {isCritical ? (
                            <span className={`${styles.badge} ${styles.badgeCritical}`}>
                              <span className={styles.badgeDot} style={{ background: "#c22f2f" }} />
                              Critical
                            </span>
                          ) : isWarning ? (
                            <span className={`${styles.badge} ${styles.badgeWarning}`}>
                              <span className={styles.badgeDot} style={{ background: "#8a5c00" }} />
                              Warning
                            </span>
                          ) : (
                            <span className={`${styles.badge} ${styles.badgeNeutral}`}>Info</span>
                          )}
                        </td>
                        <td className={styles.mono}>{e.timestamp}</td>
                        <td className={styles.mono} style={{ fontWeight: 600 }}>
                          {e.source}
                        </td>
                        <td>{e.category}</td>
                        <td>{e.message}</td>
                        <td>
                          <span className={`${styles.badge} ${isAcked ? styles.badgeGood : styles.badgeNeutral}`}>
                            {e.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Root Cause Correlation Chain Box */}
          <div className={styles.rcaBox}>
            <div className={styles.rcaTitle}>Root Cause Correlation — Event 14:20:11</div>
            <div className={styles.rcaChain}>
              <span className={styles.rcaNode}>Optical LOS, Port 214</span>
              <span className={styles.rcaArrow}>—</span>
              <span className={styles.rcaNode}>XSOS Matrix Latency spike</span>
              <span className={styles.rcaArrow}>—</span>
              <span className={styles.rcaNode}>SD-WAN Overlay tunnel flap</span>
              <span className={styles.rcaArrow}>—</span>
              <span className={styles.rcaNode}>Member BGP session reset, AS64512</span>
            </div>
          </div>
        </div>

        {/* Right: Maintenance Ticket Queue */}
        <div className={`${styles.card} ${styles.col1}`}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Maintenance Ticket Queue</div>
            <span className={`${styles.badge} ${styles.badgeNeutral}`}>0 open</span>
          </div>

          <div className={styles.cardBody}>
            {tickets.map((t) => (
              <div key={t.id} className={styles.ticket}>
                <div className={styles.ticketTop}>
                  <span className={styles.ticketId}>{t.id}</span>
                  <span className={`${styles.badge} ${styles.badgeGood}`}>{t.status}</span>
                </div>
                <div className={styles.ticketSubject}>{t.subject}</div>
                <div className={styles.ticketMeta}>{t.meta}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
