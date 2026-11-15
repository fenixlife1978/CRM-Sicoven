import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdminsWorkspace from "@/components/AdminsWorkspace";

export const dynamic = "force-dynamic";

export default async function AdministradoresPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/panel");
  return <AdminsWorkspace />;
}
