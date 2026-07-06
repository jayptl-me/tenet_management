export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface IMealFeedback {
  id: string;
  tenantId: string;
  date: string;
  mealType: MealType;
  rating: number;
  comment?: string;
  categories: string[];
  createdAt: string;
}

export interface IMealFeedbackCreate {
  mealType: MealType;
  rating: number;
  comment?: string;
  categories?: string[];
}

export interface IMealFeedbackSummary {
  avgRating: number;
  totalCount: number;
  distribution: Record<number, number>;
}
