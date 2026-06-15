import mongoose, { Document, Types } from "mongoose";

export interface IPushSubscription extends Document {
  userId: Types.ObjectId;
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const schema = new mongoose.Schema<IPushSubscription>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { timestamps: true }
);

export default mongoose.models.PushSubscription ??
  mongoose.model<IPushSubscription>("PushSubscription", schema);
