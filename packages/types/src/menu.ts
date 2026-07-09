import type { MealType } from './meal';

export interface IMenuItem {
  name: string;
  description?: string;
  category?: string;
}

export interface IDailyMenu {
  id: string;
  date: string;
  meals: Record<MealType, IMenuItem[]>;
}
