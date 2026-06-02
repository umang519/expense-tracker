import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ITransaction extends Document {
  userId: Types.ObjectId;
  date: Date;
  amount: number;
  type: "Dr" | "Cr";
  description: string;
}

const TransactionSchema = new Schema<ITransaction>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  date: {
    type: Date,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ["Dr", "Cr"],
    required: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
});

const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ??
  mongoose.model<ITransaction>("Transaction", TransactionSchema);

export default Transaction;
