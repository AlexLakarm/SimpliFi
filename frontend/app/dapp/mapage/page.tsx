"use client"

import { useRole } from "@/hooks/useRole";
import { AdminPage } from "@/components/shared/admin-page";
import { CGPPage } from "@/components/shared/cgp-page";
import ClientPage from "@/components/shared/client-page";

export default function MaPage() {
  const roleState = useRole();

  if (!roleState.role) {
    return null;
  }

  switch (roleState.role) {
    case "ADMIN":
      return <AdminPage />;
    case "CGP":
      return <CGPPage />;
    case "CLIENT":
      return <ClientPage />;
    default:
      return null;
  }
}