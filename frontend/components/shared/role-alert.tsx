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
    <div className="fixed top-20 left-4 w-full max-w-lg">
      <Alert variant="default" className="bg-background/95 backdrop-blur-sm border-muted py-3">
        <div className="flex items-center gap-4">
          {hasRole ? (
            <UserCheck className="h-6 w-6 text-green-500 flex-shrink-0" />
          ) : (
            <UserX className="h-6 w-6 text-red-400 flex-shrink-0" />
          )}
          <div className="space-y-0.5">
            <AlertTitle className="text-base font-medium">
              Bienvenue
            </AlertTitle>
            <AlertDescription className="text-sm text-muted-foreground">
              {hasRole ? (
                <>
                  Vous êtes connecté avec l&apos;adresse {address?.slice(0, 6)}...{address?.slice(-4)}, 
                  cette adresse est bien enregistrée en tant que <span className="font-semibold text-foreground">{role}</span> sur SimpliFi.
                </>
              ) : (
                <>
                  Vous êtes connecté avec l&apos;adresse {address?.slice(0, 6)}...{address?.slice(-4)}, 
                  cette adresse n&apos;a pas encore de rôle attribué sur SimpliFi.{' '}
                  <Link 
                    href="/dapp/contact" 
                    className="underline underline-offset-4 hover:text-primary"
                  >
                    Contactez-nous !
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