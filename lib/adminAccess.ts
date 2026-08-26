import { Types } from "mongoose";
import { isAdminEmail, type UserRole } from "@/lib/auth";
import User from "@/models/User";

// Node-only (writes to Mongo) — never import this from proxy.ts, which runs on
// the Edge runtime and can't reach Mongoose. Call from login/verify-email/
// refresh route handlers right before signing the JWT.
export async function resolveRole(user: {
  _id: Types.ObjectId;
  email: string;
  role: UserRole;
}): Promise<UserRole> {
  if (user.role === "admin") return "admin";
  if (isAdminEmail(user.email)) {
    await User.findByIdAndUpdate(user._id, { role: "admin" });
    return "admin";
  }
  return "user";
}
