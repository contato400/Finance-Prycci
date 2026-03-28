import type { Metadata } from "next";
import "./globals.css";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "FinanceOS — Organização Financeira Pessoal",
  description: "App de organização financeira pessoal com integração bancária e insights de IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-slate-950 font-sans antialiased">
        <AuthSessionProvider>
          {children}
          <Toaster />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
