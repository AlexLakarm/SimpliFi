import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UserCheck, UserX } from "lucide-react";
import Link from "next/link";
import { RoleState } from "@/hooks/useRole";

type RoleAlertProps = {
  roleState: RoleState;
};

export function RoleAlert({ roleState }: RoleAlertProps) {
  const { role, isPending, error, isConnected, address, hasRole } = roleState;

  if (!isConnected) {
    return null;
  }

  if (isPending) {
    return (
      <div className="fixed top-20 left-4 w-full max-w-sm">
        <Alert variant="default" className="bg-background/95 backdrop-blur-sm border-muted">
          <AlertTitle className="text-lg">Chargement...</AlertTitle>
          <AlertDescription className="mt-2 text-base">
            Vérification de votre rôle en cours...
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed top-20 left-4 w-full max-w-sm">
        <Alert variant="destructive" className="bg-destructive/95 backdrop-blur-sm">
          <AlertTitle className="text-lg">Erreur</AlertTitle>
          <AlertDescription className="mt-2 text-base">
            Impossible de vérifier votre rôle. Veuillez réessayer ou contactez-nous.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="
      fixed 
      top-[60px] 
      md:top-[72px] 
      left-4 
      w-[calc(100%-2rem)] 
      sm:w-[500px] 
      md:w-1/3
      min-w-[300px] 
      max-w-[600px]
      z-40
    ">
      <Alert variant="default" className="
        bg-background/95 
        backdrop-blur-sm 
        border-muted 
        py-1.5 
        md:py-2 
        px-3 
        md:px-4
        mt-2
        shadow-lg
      ">
        <div className="flex items-center gap-1.5 md:gap-3">
          {hasRole ? (
            <UserCheck className="h-4 w-4 md:h-5 md:w-5 text-green-500 flex-shrink-0" />
          ) : (
            <UserX className="h-4 w-4 md:h-5 md:w-5 text-red-400 flex-shrink-0" />
          )}
          <div className="space-y-0">
            <AlertTitle className="text-xs md:text-sm font-medium">
              Bienvenue
            </AlertTitle>
            <AlertDescription className="text-xs md:text-sm text-muted-foreground leading-tight">
              {hasRole ? (
                <>
                  L&apos;adresse {address?.slice(0, 6)}...{address?.slice(-4)}{' '}
                  est enregistrée en tant que <span className="font-semibold text-foreground">{role}</span> sur SimpliFi.
                </>
              ) : (
                <>
                  L&apos;adresse {address?.slice(0, 6)}...{address?.slice(-4)} n&apos;a pas de rôle.{' '}
                  <Link 
                    href="/dapp/contact" 
                    className="underline underline-offset-2 hover:text-primary"
                  >
                    Contactez-nous
                  </Link>
                </>
              )}
            </AlertDescription>
          </div>
        </div>
      </Alert>
    </div>
  );
} 