"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { NAV_ITEMS } from "@/lib/constants";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-white/95 backdrop-blur md:hidden">
      <ul className="flex overflow-x-auto px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                className={clsx(
                  "flex h-14 min-w-20 items-center justify-center px-3 text-xs font-medium",
                  isActive ? "text-[var(--ink)]" : "text-neutral-500",
                )}
                href={item.href}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
