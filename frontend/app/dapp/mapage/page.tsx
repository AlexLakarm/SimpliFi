"use client"

import { useRole } from "@/hooks/useRole";
import { RoleAlert } from "@/components/shared/role-alert";
import { AdminPage } from "@/components/shared/admin-page";
import { CGPPage } from "@/components/shared/cgp-page";
import { ClientPage } from "@/components/shared/client-page";

export default function MaPage() {
  const roleState = useRole();
  const { role, isConnected } = roleState;

  // Afficher l'alerte de rôle
  const alert = <RoleAlert roleState={roleState} />;

  // Si pas connecté ou pas de rôle, on affiche juste l'alerte
  if (!isConnected || !role || role === "NO_ROLE") {
    return alert;
  }

  // Fonction pour obtenir le composant en fonction du rôle
  const getPageComponent = () => {
    switch (role) {
      case "ADMIN":
        return <AdminPage />;
      case "CGP":
        return <CGPPage />;
      case "CLIENT":
        return <ClientPage />;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="mt-6">
        {getPageComponent()}
      </div>
    </>
  );
}