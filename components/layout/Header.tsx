import Link from "next/link";
import { Heart } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Logo";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { AuthStatus } from "@/components/layout/AuthStatus";
import { navLinks } from "@/components/layout/nav-links";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface">
      <Container className="flex h-20 items-center justify-between gap-6">
        <Logo />

        <nav className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[15px] font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          <Link
            href="/dashboard/favorites"
            aria-label="Избранное"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-foreground/70 transition-colors hover:bg-black/[0.04] hover:text-foreground"
          >
            <Heart size={20} />
          </Link>
          <AuthStatus />
          <Button href="/sell/new">Подать объявление</Button>
        </div>

        <MobileMenu />
      </Container>
    </header>
  );
}
