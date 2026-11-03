import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AnalyticsDashboard from "./ui";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/");
  return <main className="page"><header><div><Link href="/">← Centro de control</Link><p>EFASfreelancer · INTELIGENCIA COMERCIAL</p><h1>Analítica de productos</h1><span>Rendimiento de las páginas, campañas y descargas de tus programas.</span></div></header><AnalyticsDashboard /></main>;
}
