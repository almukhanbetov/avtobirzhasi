import Link from "next/link";
import { Car } from "lucide-react";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
        <Car size={18} strokeWidth={2.25} />
      </span>
      <span className="text-lg font-semibold tracking-tight text-foreground">
        AVTO<span className="text-brand">BIRZHASI</span>
      </span>
    </Link>
  );
}
