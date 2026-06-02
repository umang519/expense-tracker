// Client-side types for API responses

export interface CategorySummary {
  _id: string;
  name: string;
  color: string;
}

export interface PopulatedExpense {
  _id: string;
  date: string;
  amount: number;
  note?: string;
  categoryId: CategorySummary;
}

export interface Category {
  _id: string;
  name: string;
  color: string;
  sortOrder: number;
  isArchived: boolean;
}
