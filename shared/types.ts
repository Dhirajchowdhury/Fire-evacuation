export type NodeStatus = "safe" | "fire" | "blocked" | "exit"
export type ZoneId = "A" | "B" | "C" | "D"
export type NodeType = "room" | "corridor" | "hub" | "exit"

export interface BuildingNode {
  id: string
  label: string
  type: NodeType
  zone: ZoneId | null
  position: { x: number; y: number; z: number }
  status: NodeStatus
}

export interface BuildingGraph {
  nodes: BuildingNode[]
  edges: [string, string][]
}

export interface ZoneAlert {
  id: string
  zone_id: ZoneId
  status: "fire" | "safe"
  message: string
  created_at: string
}

export interface ZoneStatus {
  id: number
  zone_id: ZoneId
  status: "fire" | "safe"
  last_updated: string
}

export interface EvacuationRoute {
  path: string[]
  exit: string
  blocked_zones: ZoneId[]
  description: string
}

export interface Workspace {
  id: string
  name: string
  location: string
  admin_id: string
  floor_plan_url: string | null
  building_graph: BuildingGraph | null
  qr_code: string | null
  invite_link: string
  created_at: string
}

export interface Profile {
  id: string
  full_name: string
  phone: string
  role: 'admin' | 'user'
  workspace_id: string
  created_at: string
}

export interface Announcement {
  id: string
  workspace_id: string
  admin_id: string
  title: string
  message: string
  type: string
  created_at: string
}

export interface Drill {
  id: string
  workspace_id: string
  triggered_by: string
  started_at: string
  ended_at: string | null
  status: 'active' | 'completed'
  notes: string | null
  acknowledged_count: number
}

export interface DrillAcknowledgement {
  id: string
  drill_id: string
  user_id: string
  acknowledged_at: string
}

export interface IncidentRecord {
  id: string
  workspace_id: string
  zone_id: string
  started_at: string
  ended_at: string | null
  evacuation_path: string[]
  total_alerts: number
  resolved_by: string | null
  notes: string | null
}

export interface EmergencyContact {
  id: string
  workspace_id: string
  name: string
  role: string
  phone: string
  type: 'fire' | 'ambulance' | 'police' | 'manager' | 'other'
}

export interface SensorDevice {
  id: string
  workspace_id: string
  device_id: string
  zone_id: string
  status: 'online' | 'offline'
  last_ping: string
  battery_level: number | null
  signal_strength: number | null
}
