"use client"

import AdminFees from "@/components/shared/admin-fees";
import CGPFees from "@/components/shared/cgp-fees";
import { useRole } from "@/hooks/useRole";

export default function FeesPage() {

    const roleState = useRole();

    if (!roleState.role) {
        return null;
      }
    
      switch (roleState.role) {
        case "ADMIN":
          return <AdminFees />;
        case "CGP":
          return <CGPFees />;
        case "CLIENT":
          return null ;
        default:
          return null;
      }
}
