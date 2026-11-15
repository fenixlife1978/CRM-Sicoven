import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ModuleWorkspace from "@/components/ModuleWorkspace";

export const dynamic = "force-dynamic";

export default async function LicenciasPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <ModuleWorkspace kind="licencias" />;
}
