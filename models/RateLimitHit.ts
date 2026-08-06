import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRateLimitHit extends Document {
  key: string;
  count: number;
  expiresAt: Date;
}

const RateLimitHitSchema = new Schema<IRateLimitHit>({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

const RateLimitHit: Model<IRateLimitHit> =
  mongoose.models.RateLimitHit ??
  mongoose.model<IRateLimitHit>("RateLimitHit", RateLimitHitSchema);

export default RateLimitHit;
