"use client";

import { Card } from "@/components/ui/card";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import { RoleAlert } from "@/components/shared/role-alert";

const menuItems = [
  { label: "Stratégies", href: "/dapp" },
  { label: "Marketplace", href: "/dapp/marketplace" },
  { label: "Ma Page", href: "/dapp/mapage" },
  { label: "Contact", href: "/dapp/contact" },
];

export default function DappLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const roleState = useRole();
  const { role, isConnected } = roleState;

  // Afficher l'alerte de rôle
  const alert = <RoleAlert roleState={roleState} />;

  // Si pas connecté ou pas de rôle, on affiche juste l'alerte
  if (!isConnected || !role || role === "NO_ROLE") {
    return alert;
  }

  return (
    <div className="pt-[72px]">
      <div className="container mx-auto p-4">
        {/* Container principal avec flex */}
        <div className="
          flex 
          flex-col 
          md:flex-row 
          md:justify-between 
          md:items-start 
          gap-4 
          md:gap-8
        ">
          {/* Colonne gauche - Alert */}
          <div className="
            w-full 
            md:w-1/3 
            order-2 
            md:order-1
          ">
            {alert}
          </div>

          {/* Colonne centrale - Menu */}
          <div className="
            w-full 
            md:w-1/3 
            order-1 
            md:order-2
            overflow-x-auto    /* Permet le scroll horizontal */
            scrollbar-none     /* Cache la scrollbar sur desktop */
            -mx-4             /* Étend la zone de scroll jusqu'aux bords */
            px-4              /* Restaure le padding interne */
          ">
            <Card className="
              p-0.5 
              md:p-1 
              bg-background/95 
              backdrop-blur-sm 
              border-white/40
              inline-block     /* Permet au conteneur de s'adapter à la largeur du contenu */
              min-w-full      /* Force la largeur minimale à 100% */
            ">
              <nav className="
                flex 
                gap-0.5 
                sm:gap-1
                justify-start  /* Aligne les éléments à gauche */
                w-fit         /* Permet au nav de s'étendre selon le contenu */
              ">
                {menuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "px-2 sm:px-3 md:px-4 py-1.5 md:py-2",  /* Réduit le padding sur mobile */
                      "text-xs sm:text-sm md:text-base",       /* Réduit la taille du texte sur mobile */
                      "whitespace-nowrap",                     /* Empêche le retour à la ligne du texte */
                      "rounded-md transition-colors duration-200",
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

          {/* Colonne droite - Vide */}
          <div className="hidden md:block w-1/3 order-3" />
        </div>

        {/* Contenu principal */}
        <main className="relative z-20 mt-6">
          {children}
        </main>
      </div>
    </div>
  );
} 