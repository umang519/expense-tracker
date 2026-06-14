import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IBudget extends Document {
  userId: Types.ObjectId;
  categoryId: Types.ObjectId | null; // null = overall monthly budget
  amount: number;
}

const BudgetSchema = new Schema<IBudget>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: "Category",
    default: null,
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
  },
});

// One budget per user+category (null categoryId = overall)
BudgetSchema.index({ userId: 1, categoryId: 1 }, { unique: true });

const Budget: Model<IBudget> =
  mongoose.models.Budget ??
  mongoose.model<IBudget>("Budget", BudgetSchema);

export default Budget;
