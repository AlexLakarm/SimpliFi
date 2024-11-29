"use client"

import { useRole } from "@/hooks/useRole";
import { RoleAlert } from "@/components/shared/role-alert";
import { useEffect } from "react";

export default function DappPage() {
  const roleState = useRole();
  
  useEffect(() => {
    if (roleState.role) {
      console.log('Role détecté :', {
        role: roleState.role,
        address: roleState.address,
        hasRole: roleState.hasRole,
        isConnected: roleState.isConnected
      });
    }
  }, [roleState]);
  
  return (
    <>
      <RoleAlert roleState={roleState} />
      <h2 className="text-3xl font-bold mt-4 text-center">Bienvenue sur votre page</h2>
    </>
  );
}