import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (token && (await verifyJWT(token))) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {children}
    </div>
  );
}
