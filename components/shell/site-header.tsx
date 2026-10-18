import Link from "next/link";
import { NavLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Planti home">
          <Sprout />
          <span className="font-serif text-[1.375rem] font-medium tracking-tight text-forest">planti</span>
        </Link>
        <NavLinks />
      </div>
    </header>
  );
}

function Sprout() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true" className="text-forest">
      <path d="M13 23V12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13 13.5C13 9 10 6 4.5 6c0 5 3 7.5 8.5 7.5Z" fill="currentColor" opacity="0.88" />
      <path d="M13 11c0-4.2 2.8-7.5 8.5-7.5 0 5-3.2 7.5-8.5 7.5Z" fill="var(--color-moss)" />
    </svg>
  );
}
