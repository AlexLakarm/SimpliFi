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
    <div className="container mx-auto p-4">
      {/* Menu de navigation */}
      <div className="flex justify-center mb-8">
        <Card className="p-1">
          <nav className="flex gap-1">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-6 py-2 rounded-md transition-colors duration-200",
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

      {/* Contenu de la page */}
      <main>
        {children}
      </main>
    </div>
  );
} 