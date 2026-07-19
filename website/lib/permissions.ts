export const DEALERSHIP_PERMISSIONS = [
  { id: "view_dashboard", label: "View dashboard", group: "View" },
  { id: "view_audit", label: "View audit", group: "View" },
  { id: "view_vehicles", label: "View vehicles", group: "View" },
  { id: "view_map", label: "View map", group: "View" },
  { id: "view_members", label: "View team", group: "View" },
  { id: "scan_vehicles", label: "Scan vehicles", group: "Lot operations" },
  { id: "manage_uploads", label: "Manage uploads", group: "Lot operations" },
  { id: "export_audits", label: "Export audits", group: "Lot operations" },
  { id: "manage_vehicles", label: "Manage vehicles", group: "Lot operations" },
  { id: "manage_map", label: "Manage map", group: "Lot operations" },
  { id: "manage_members", label: "Manage members", group: "Team access" },
  { id: "manage_roles", label: "Manage roles", group: "Team access" },
  { id: "manage_dealership", label: "Manage dealership", group: "Team access" },
] as const;

export type PermissionId = (typeof DEALERSHIP_PERMISSIONS)[number]["id"];
export const ALL_PERMISSION_IDS = DEALERSHIP_PERMISSIONS.map((item) => item.id);
