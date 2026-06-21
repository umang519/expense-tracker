import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name?: string;
  currency: string;
  pendingEmail?: string;
  emailOtp?: string;
  emailOtpExpiresAt?: Date;
  isEmailVerified: boolean;
  verifyOtp?: string;
  verifyOtpExpiresAt?: Date;
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
    pendingEmail: { type: String },
    emailOtp: { type: String },
    emailOtpExpiresAt: { type: Date },
    isEmailVerified: { type: Boolean, default: false },
    verifyOtp: { type: String },
    verifyOtpExpiresAt: { type: Date },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);

export default User;
