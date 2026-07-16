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
  /** Derived: date >= today in PG timezone. */
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IDailyMenuCreate {
  date: string;
  meals: {
    breakfast?: IMenuItem[];
    lunch?: IMenuItem[];
    dinner?: IMenuItem[];
  };
}
