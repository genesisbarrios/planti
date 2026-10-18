"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/plants", label: "Plants" },
  { href: "/settings", label: "Settings" },
] as const;

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary">
      <ul className="flex items-center gap-0.5 text-sm sm:gap-1">
        {LINKS.map(({ href, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-md px-2 py-2 transition-colors sm:px-3 ${
                  active ? "bg-moss-soft font-medium text-forest" : "text-ink-muted hover:bg-sunken hover:text-ink"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
