import type { ConnectionItem, InventoryItem, Port, PortsSummary, QueueItem, SystemStatus } from "@/types/nms";

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PANELS = ["XSOS-576D-1", "XSOS-576D-2"];
export const PORTS_PER_PANEL = 288;

const SAMPLE_CUSTOMERS = [
  "Telkomsel DWDM Backbone",
  "Indosat Ooredoo IXP",
  "XL Axiata Core",
  "Cloudflare Edge POP",
  "AWS Direct Connect",
  "Equinix JK1 Cross-Connect",
  "Singtel IP-Transit",
  "Google Cloud Interconnect",
];

export interface MockState {
  ports: Record<string, Port>;
  connections: ConnectionItem[];
  queue: QueueItem[];
  summary: PortsSummary;
  systemStatus: SystemStatus;
  inventory: InventoryItem[];
}

export function buildMockState(seed = 20260222): MockState {
  const rand = mulberry32(seed);
  const ports: Record<string, Port> = {};

  PANELS.forEach((panel) => {
    for (let i = 1; i <= PORTS_PER_PANEL; i++) {
      const key = `${panel}#${i}`;
      // Ports 141-144 on East and 285-288 on West are Interconnection Trunks
      const isInterconn = (i >= 141 && i <= 144) || (i >= 285 && i <= 288);
      const hasCustomer = !isInterconn && rand() > 0.65;
      const cust = hasCustomer ? SAMPLE_CUSTOMERS[Math.floor(rand() * SAMPLE_CUSTOMERS.length)] : null;

      ports[key] = {
        id: Object.keys(ports).length + 1,
        port_no: i,
        description: `${panel}: Port-${i}`,
        panel_name: panel,
        status: "Available",
        connected_port: null,
        reserved_as_interconnection: isInterconn,
        allocated_to_customer: cust,
        fiber_type: "Duplex",
        smu_type: i <= 144 ? "East" : "West",
        serial_no: rand() > 0.4 ? `XEN2026${String(Math.floor(rand() * 9999)).padStart(4, "0")}-S${i}` : null,
        connected_count: Math.floor(rand() * 55),
      };
    }
  });

  const keys = Object.keys(ports);
  const shuffled = [...keys].sort(() => rand() - 0.5);
  const used = new Set<string>();
  const connections: ConnectionItem[] = [];
  let cid = 1;

  for (let i = 0; i < shuffled.length && connections.length < 102; i++) {
    const a = shuffled[i];
    if (used.has(a)) continue;
    const sameP = rand() > 0.3;
    let b: string | null = null;
    for (let j = i + 1; j < shuffled.length; j++) {
      const cand = shuffled[j];
      if (used.has(cand)) continue;
      if (sameP && ports[cand].panel_name !== ports[a].panel_name) continue;
      b = cand;
      break;
    }
    if (!b) continue;
    used.add(a);
    used.add(b);
    ports[a].status = "Connected";
    ports[b].status = "Connected";
    ports[a].connected_port = ports[b].port_no;
    ports[b].connected_port = ports[a].port_no;

    connections.push({
      no: connections.length + 1,
      connection_id: cid++,
      operation_name: "Connect",
      source: [{ panel_name: ports[a].panel_name, port_no: ports[a].port_no, port_description: ports[a].description }],
      target: [{ panel_name: ports[b].panel_name, port_no: ports[b].port_no, port_description: ports[b].description }],
      created_by: rand() > 0.5 ? "EMS" : "Eko",
      remark: rand() > 0.6 ? "EMS Connection" : "",
    });
  }

  const queue: QueueItem[] = [
    {
      no: 1,
      connection_id: 9001,
      operation_name: "Connect",
      source: [{ panel_name: "XSOS-576D-1", port_no: 65, port_description: "XSOS-576D-1: Port-65" }],
      target: [{ panel_name: "XSOS-576D-1", port_no: 165, port_description: "XSOS-576D-1: Port-165" }],
      status: "Waiting",
      scheduled_at: "2026-09-22T14:44:09",
      created_by: "Eko",
    },
  ];

  const portList = Object.values(ports);
  const summary: PortsSummary = {
    total_ports: portList.length,
    available_ports: portList.filter((p) => p.status === "Available").length,
    connected_port: portList.filter((p) => p.status === "Connected").length,
    interconnection_port: portList.filter((p) => p.reserved_as_interconnection).length,
    disabled_port: portList.filter((p) => p.status === "Disabled").length,
  };

  const systemStatus: SystemStatus = {
    status: "Ready",
    total_queue: queue.length,
    total_connection: connections.length,
    total_notification: 0,
  };

  const inventory: InventoryItem[] = [
    {
      id: 1,
      no: 1,
      name: "XSOS-576D-1",
      ip_address: "10.200.1.10",
      model_name: "XSOS-576DLC",
      model_fiber_type: "Duplex",
      ems_name: "XSOSHOST-01",
      serial_no: "S202120501006",
      software_version: "2.0.0.2",
      firmware_version: "1.0.0",
      timezone: "UTC (+0000)",
      uptime: "14d 6h 32m",
      status: "Ready",
      progress: null,
      alarm_msg: null,
    },
    {
      id: 2,
      no: 2,
      name: "XSOS-576D-2",
      ip_address: "10.200.1.11",
      model_name: "XSOS-576DLC",
      model_fiber_type: "Duplex",
      ems_name: "XSOSHOST-02",
      serial_no: "S202120501007",
      software_version: "2.0.0.2",
      firmware_version: "1.0.0",
      timezone: "UTC (+0000)",
      uptime: "14d 6h 32m",
      status: "Ready",
      progress: null,
      alarm_msg: null,
    },
  ];

  return { ports, connections, queue, summary, systemStatus, inventory };
}
