import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name?: string;
  currency: string;
  role: "user" | "admin";
  avatarUrl?: string;
  avatarPublicId?: string;
  pendingEmail?: string;
  emailOtp?: string;
  emailOtpExpiresAt?: Date;
  isEmailVerified: boolean;
  verifyOtp?: string;
  verifyOtpExpiresAt?: Date;
  resetOtp?: string;
  resetOtpExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      trim: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    avatarUrl: { type: String },
    avatarPublicId: { type: String },
    pendingEmail: { type: String },
    emailOtp: { type: String },
    emailOtpExpiresAt: { type: Date },
    isEmailVerified: { type: Boolean, default: false },
    verifyOtp: { type: String },
    verifyOtpExpiresAt: { type: Date },
    resetOtp: { type: String },
    resetOtpExpiresAt: { type: Date },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);

export default User;
