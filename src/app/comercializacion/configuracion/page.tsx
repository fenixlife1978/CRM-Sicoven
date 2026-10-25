import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import CommercialSettings from "@/components/CommercialSettings";

export const dynamic = "force-dynamic";

export default async function CommercialSettingsPage() {
  const session=await getSession();
  if(!session) redirect("/login");
  if(session.role!=="admin") redirect("/");
  return <CommercialSettings />;
}
