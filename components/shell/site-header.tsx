import { LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/auth";
import { NavLinks } from "./nav-links";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Planti home">
          {/* The SVGs carry their own padding; sizes are tuned to the visible mark. */}
          <Image src="/planti-logo/logos/svg/planti-logo-forest.svg" alt="Planti" width={129} height={48} priority unoptimized className="hidden h-12 w-auto sm:block" />
          <Image src="/planti-logo/mark-colors/planti-mark-forest.svg" alt="Planti" width={36} height={36} priority unoptimized className="h-9 w-9 sm:hidden" />
        </Link>
        <div className="flex min-w-0 items-center gap-1 sm:gap-4">
          <NavLinks />
          {user ? (
            <form action={signOut} className="flex items-center gap-3 border-l border-line pl-1 sm:pl-4">
              <span className="hidden max-w-[16ch] truncate text-sm text-ink-muted md:inline" title={user.email ?? undefined}>
                {user.email}
              </span>
              <button
                type="submit"
                aria-label="Sign out"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-sm text-ink-muted hover:bg-sunken hover:text-ink"
              >
                <LogOut className="h-4 w-4 sm:hidden" aria-hidden="true" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          ) : (
            <Link href="/login" className="whitespace-nowrap rounded-md px-2 py-2 text-sm font-medium text-forest hover:bg-moss-soft sm:px-3">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
