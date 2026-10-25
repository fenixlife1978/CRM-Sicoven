import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { bootstrapDatabase } from "@/lib/bootstrap";
import CommercialPayments from "@/components/CommercialPayments";

export const dynamic = "force-dynamic";

export default async function CommercializationPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/");
  await bootstrapDatabase().catch(() => undefined);
  return <CommercialPayments />;
}
