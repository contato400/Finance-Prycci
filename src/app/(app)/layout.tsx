import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { DateRangeProvider } from "@/contexts/date-range-context";

// Layout protegido — middleware.ts redireciona para login se não autenticado
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DateRangeProvider>
      <div className="min-h-screen bg-slate-950">
        <Sidebar />
        <div className="lg:pl-64">
          <Header />
          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    </DateRangeProvider>
  );
}
