// Tipe data mengikuti skema respons NMS API v2.0.2.2
// (lihat NMS_API_Integration_Plan.md untuk detail endpoint)

export type PortStatus = "Available" | "Connected" | "Disabled" | "Reserved";

export interface Port {
  id: number;
  port_no: number;
  description: string;
  panel_name: string;
  status: PortStatus;
  connected_port: number | null;
  reserved_as_interconnection: boolean;
  allocated_to_customer: string | null;
  fiber_type: string;
  smu_type: "East" | "West" | string;
  serial_no: string | null;
  connected_count: number;
}

export interface PortsSummary {
  total_ports: number;
  available_ports: number;
  connected_port: number;
  interconnection_port: number;
  disabled_port: number;
}

export interface ConnectionEndpoint {
  panel_name: string;
  port_no: number;
  port_description: string;
}

export interface ConnectionItem {
  no: number;
  connection_id: number;
  operation_name: string;
  source: ConnectionEndpoint[];
  target: ConnectionEndpoint[];
  scheduled_at?: string;
  created_at?: string;
  created_by?: string;
  remark?: string;
  started_at?: string;
  finished_at?: string;
}

export type QueueStatus = "Waiting" | "Operating" | "Failed";

export interface QueueItem extends ConnectionItem {
  status: QueueStatus;
}

export interface SystemStatus {
  status: "Ready" | "Paused" | string;
  total_queue: number;
  total_connection: number;
  total_notification: number;
}

export interface ListResponse<T> {
  total_count: number;
  items: T[];
}

export interface InventoryItem {
  id: number;
  no: number;
  name: string;
  ip_address: string;
  model_name: string;
  model_fiber_type: string;
  ems_name: string;
  serial_no: string;
  software_version: string;
  firmware_version: string;
  timezone: string;
  uptime: string;
  status: string;
  progress?: string | null;
  alarm_msg?: string | null;
}

