import { Container } from "@/components/ui/Container";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { RequireAuth } from "@/components/auth/RequireAuth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="py-10 sm:py-14">
      <Container className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        <RequireAuth>
          <DashboardNav />
          <div className="flex min-w-0 flex-1 flex-col gap-8">{children}</div>
        </RequireAuth>
      </Container>
    </div>
  );
}
