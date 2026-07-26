import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/layout/Logo";

const columns = [
  {
    title: "Покупателям",
    links: [
      { href: "/cars", label: "Все автомобили" },
      { href: "/buy", label: "Купить сейчас" },
      { href: "/exchange", label: "Купить через Автобиржу" },
      { href: "/dashboard/favorites", label: "Избранное" },
    ],
  },
  {
    title: "Продавцам",
    links: [
      { href: "/sell/new", label: "Подать объявление" },
      { href: "/sell", label: "Как продать быстрее" },
      { href: "/how-it-works", label: "Как это работает" },
    ],
  },
  {
    title: "Компания",
    links: [
      { href: "/about", label: "О нас" },
      { href: "/safety", label: "Безопасность сделок" },
      { href: "/contacts", label: "Контакты" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <Container className="grid grid-cols-1 gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <Logo />
          <p className="max-w-xs text-[15px] text-muted-foreground">
            Автомобильная биржа Казахстана. Покупайте и продавайте по цене,
            которая устраивает обе стороны.
          </p>
        </div>

        {columns.map((column) => (
          <div key={column.title} className="flex flex-col gap-4">
            <span className="text-[15px] font-semibold text-foreground">
              {column.title}
            </span>
            <nav className="flex flex-col gap-3">
              {column.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[15px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        ))}
      </Container>

      <div className="border-t border-border">
        <Container className="flex flex-col gap-2 py-6 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 AVTOBIRZHASI.KZ. Все права защищены.</span>
          <span>Казахстан</span>
        </Container>
      </div>
    </footer>
  );
}
