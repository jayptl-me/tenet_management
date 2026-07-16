export type MealType = 'breakfast' | 'lunch' | 'dinner';

export type MealFeedbackStatus = 'submitted' | 'acknowledged' | 'actioned';

export type MealFeedbackCategory =
  | 'taste'
  | 'variety'
  | 'quantity'
  | 'cleanliness'
  | 'service';

export interface IMealFeedback {
  id: string;
  tenantId: string;
  date: string;
  mealType: MealType;
  rating: number;
  status: MealFeedbackStatus;
  comment?: string;
  categories: MealFeedbackCategory[];
  createdAt: string;
}

/** Tenant self-service feedback create (categories required by API). */
export interface IMealFeedbackCreate {
  date: string;
  mealType: MealType;
  rating: number;
  categories: MealFeedbackCategory[];
  comment?: string;
}

/** Admin records feedback on behalf of a tenant (no categories required). */
export interface IAdminMealFeedbackCreate {
  tenantId: string;
  date: string;
  mealType: MealType;
  rating: number;
  comment?: string;
}

/** One rollup row from GET /meals/feedback/summary. */
export interface IMealFeedbackSummaryRow {
  date: string;
  mealType: MealType;
  avgRating: number;
  count: number;
}

/** @deprecated Prefer IMealFeedbackSummaryRow[]; kept for gradual migration. */
export interface IMealFeedbackSummary {
  avgRating: number;
  totalCount: number;
  distribution: Record<number, number>;
}
