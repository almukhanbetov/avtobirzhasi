import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Providers } from "@/app/providers";

// Runs before hydration (strategy="beforeInteractive") so the stored/system
// theme is applied to <html> before first paint — without this, the page
// would flash the light theme for a moment even for a user who picked
// dark. Must stay in sync with lib/theme/ThemeProvider.tsx's own logic.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("avtobirzhasi_theme");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    if (theme === "dark") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "AVTOBIRZHASI — автомобильная биржа Казахстана",
  description:
    "Покупайте и продавайте автомобили по своей цене. Автобиржа автоматически сводит покупателя и продавца, когда цены совпадают.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
