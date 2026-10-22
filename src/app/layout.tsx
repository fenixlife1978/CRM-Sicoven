import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM SICOVEN",
  description: "Gestión de clientes, productos y licencias SICOVEN"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
