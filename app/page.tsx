import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT } from "@/lib/auth";

export default async function RootPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (token && (await verifyJWT(token))) {
    redirect("/dashboard");
  }
  redirect("/login");
}
