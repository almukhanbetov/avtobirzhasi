import { Container } from "@/components/ui/Container";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="py-10 sm:py-14">
      <Container className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col gap-8">{children}</div>
      </Container>
    </div>
  );
}
