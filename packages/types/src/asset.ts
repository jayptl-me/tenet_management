// ── Asset / Inventory ──────────────────────────────────
export type AssetCategory = 'furniture' | 'appliance' | 'electronics' | 'cleaning' | 'other';

export type AssetStatus = 'available' | 'in_use' | 'under_maintenance' | 'damaged' | 'retired';

export interface IAsset {
  id: string;
  name: string;
  category: AssetCategory;
  location: string;
  quantity: number;
  lowStockThreshold: number;
  status: AssetStatus;
  purchasedDate?: string;
  lastServicedDate?: string;
  nextServiceDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IAssetCreate {
  name: string;
  category: AssetCategory;
  location: string;
  quantity: number;
  lowStockThreshold: number;
  status: AssetStatus;
  purchasedDate?: string;
  lastServicedDate?: string;
  nextServiceDate?: string;
  notes?: string;
}

export interface IAssetUpdate {
  name?: string;
  category?: AssetCategory;
  location?: string;
  quantity?: number;
  lowStockThreshold?: number;
  status?: AssetStatus;
  purchasedDate?: string;
  lastServicedDate?: string;
  nextServiceDate?: string;
  notes?: string;
}
