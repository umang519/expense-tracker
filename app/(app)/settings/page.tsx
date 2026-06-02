import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import SettingsForm from "@/components/SettingsForm";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value ?? "";
  const payload = await verifyJWT(token);
  if (!payload) redirect("/login");

  await connectDB();
  const user = await User.findById(payload.sub).select("-passwordHash").lean();
  if (!user) redirect("/login");

  const userData = {
    id: user._id.toString(),
    email: user.email,
    name: user.name ?? "",
    currency: user.currency ?? "INR",
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        <div className="py-4 mb-3">
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">Manage your account</p>
        </div>
        <SettingsForm user={userData} />
      </div>
    </main>
  );
}
