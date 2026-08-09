// ── Washing Machine ───────────────────────────────────
// Per-machine tracking per floor — tenants claim machines with a timer
// (default 50 min). Admin manages machines, tenants see floor-wide status.

export type WashingMachineStatus = 'available' | 'in_use' | 'under_maintenance' | 'down';

export interface IWashingMachine {
  id: string;
  floorId: string;
  floorLabel?: string;
  floorNumber?: number;
  machineNumber: number;
  label: string;
  status: WashingMachineStatus;
  currentUserId: string | null;
  currentUser?: {
    name?: string;
    room?: string;
  };
  claimedAt: string | null;
  timerDuration: number; // minutes
  timerEndsAt: string | null; // computed: claimedAt + timerDuration
  lastUsedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface IWashingMachineCreate {
  floorId: string;
  machineNumber: number;
  label?: string;
  /** Only 'available', 'under_maintenance', 'down' — 'in_use' is set by claim endpoint only. */
  status?: 'available' | 'under_maintenance' | 'down';
  timerDuration?: number;
  notes?: string;
}

export interface IWashingMachineUpdate {
  label?: string;
  machineNumber?: number;
  /** Only 'available', 'under_maintenance', 'down' — 'in_use' is set by claim endpoint only. */
  status?: 'available' | 'under_maintenance' | 'down';
  timerDuration?: number;
  notes?: string;
}

export interface IWashingMachineClaim {
  /** Duration override in minutes (defaults to machine's timerDuration). */
  timerDuration?: number;
}

export interface IWashingMachineStatusUpdate {
  status: 'available' | 'under_maintenance' | 'down';
  notes?: string;
}
