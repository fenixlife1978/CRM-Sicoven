import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EFASfreelancer | Soluciones Digitales",
  description: "EFASfreelancer Soluciones Digitales · Administración de clientes, productos y licencias de software"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
