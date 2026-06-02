import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IExpense extends Document {
  userId: Types.ObjectId;
  date: Date;
  categoryId: Types.ObjectId;
  amount: number;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be greater than 0"],
    },
    note: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Compound index for efficient per-user date-ordered queries
ExpenseSchema.index({ userId: 1, date: -1 });

const Expense: Model<IExpense> =
  mongoose.models.Expense ?? mongoose.model<IExpense>("Expense", ExpenseSchema);

export default Expense;
