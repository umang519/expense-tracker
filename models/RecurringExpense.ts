import mongoose, { Document, Schema, Types } from "mongoose";

export interface IRecurringExpense extends Document {
  userId: Types.ObjectId;
  categoryId: Types.ObjectId;
  amount: number;
  note?: string;
  frequency: "monthly" | "weekly" | "weekdays";
  startDate: Date;
  endDate: Date | null;
  lastGeneratedDate: Date | null;
  isActive: boolean;
}

const RecurringExpenseSchema = new Schema<IRecurringExpense>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    amount: { type: Number, required: true },
    note: { type: String, trim: true, maxlength: 200 },
    frequency: { type: String, enum: ["monthly", "weekly", "weekdays"], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    lastGeneratedDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const RecurringExpense =
  mongoose.models.RecurringExpense ??
  mongoose.model<IRecurringExpense>("RecurringExpense", RecurringExpenseSchema);

export default RecurringExpense;
