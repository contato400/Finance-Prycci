import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

// Layout protegido — redireciona para login se não autenticado
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar />
      <div className="lg:pl-64">
        <Header />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
