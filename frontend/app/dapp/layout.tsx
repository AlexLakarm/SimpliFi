"use client";

import { Card } from "@/components/ui/card";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

const menuItems = [
  { label: "Stratégies", href: "/dapp" },
  { label: "Ma Page", href: "/dapp/mapage" },
  { label: "Contact", href: "/dapp/contact" },
];

export default function DappLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="pt-[72px]">
      <div className="container mx-auto p-4">
        {/* Menu de navigation */}
        <div className="
          flex justify-center 
          mb-4 md:mb-8 
          overflow-x-auto
          relative
          z-30
          pt-[60px]      /* Mobile : grand espace pour l'alerte */
          sm:pt-[40px]   /* Tablette : espace moyen */
          md:pt-2        /* Desktop : presque collé au header */
          lg:pt-0        /* Grand écran : directement sous le header */
        ">
          <Card className="p-0.5 md:p-1 bg-background/95 backdrop-blur-sm border-white/40">
            <nav className="flex gap-0.5 md:gap-1">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 md:px-6 py-1.5 md:py-2 rounded-md transition-colors duration-200",
                    "text-sm md:text-base",
                    "hover:bg-accent hover:text-accent-foreground",
                    pathname === item.href
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </Card>
        </div>

        <main className="relative z-20">
          {children}
        </main>
      </div>
    </div>
  );
} 