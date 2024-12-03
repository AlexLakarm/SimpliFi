"use client"

import { useState, useEffect } from "react";
import { useReadContract, useAccount, useWriteContract } from 'wagmi';
import { contractAddresses, contractABIs } from "@/app/config/contracts";
import { useRole } from "@/hooks/useRole";
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { useTransactionToast } from "@/hooks/use-transaction-toast";

// Type pour les positions retournées par le contrat
type Position = {
  gUSDCAmount: bigint;    // Montant initial en gUSDC
  ptAmount: bigint;       // Montant de PT reçus
  entryDate: bigint;      // Date d'entrée
  maturityDate: bigint;   // Date de maturité
  exitDate: bigint;       // Date de sortie
  isActive: boolean;      // Position active
};

export function ClientPage() {
  const { address } = useAccount();
  const { role } = useRole();
  const [isClient, setIsClient] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);

  // Hook pour l'écriture du contrat
  const { writeContract, data: hash, error, isPending } = useWriteContract();

  // Hook pour les toasts de transaction
  useTransactionToast(hash, error);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fonction pour sortir d'une stratégie
  const handleExitStrategy = async (positionId: number) => {
    writeContract({
      address: contractAddresses.strategyOne,
      abi: contractABIs.strategyOne,
      functionName: 'exitStrategy',
      args: [BigInt(positionId)],
    });
  };

  // Lecture des positions de l'utilisateur
  const { data: userPositions } = useReadContract({
    address: contractAddresses.strategyOne,
    abi: contractABIs.strategyOne,
    functionName: 'getUserPositions',
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address)
    }
  });

  // Mise à jour des positions
  useEffect(() => {
    if (userPositions) {
      setPositions(userPositions as Position[]);
    }
  }, [userPositions]);

  // Fonction pour formater les montants (conversion de BigInt en nombre avec 6 décimales pour gUSDC)
  const formatAmount = (amount: bigint) => {
    return (Number(amount) / 1e6).toFixed(2);
  };

  // Fonction pour formater les dates
  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return format(date, 'dd/MM/yyyy HH:mm');
  };

  // Fonction pour calculer le temps restant
  const getRemainingTime = (maturityDate: bigint) => {
    const date = new Date(Number(maturityDate) * 1000);
    return formatDistanceToNow(date, { addSuffix: true, locale: fr });
  };

  return (
    <div className="space-y-6 max-w-full">
      {isClient && role !== 'CLIENT' && (
        <div className="fixed top-20 left-4 w-full max-w-sm">
          <div className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md">
            Accès restreint aux clients
          </div>
        </div>
      )}
      
      <h2 className="text-3xl font-bold tracking-tight">Mes Positions</h2>
      
      <div className="grid gap-6">
        {positions.length > 0 ? (
          positions.map((position, index) => (
            position.isActive && (
              <div key={index} className="p-6 bg-card rounded-lg border space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Montant Initial</h4>
                    <p className="text-2xl font-bold">{formatAmount(position.gUSDCAmount)} gUSDC</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Montant à Maturité</h4>
                    <p className="text-2xl font-bold">{formatAmount(position.ptAmount)} gUSDC</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Id NFT Reçu</h4>
                    <p className="text-2xl font-bold">Id # {index + 1}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Date d&apos;Entrée</h4>
                    <p className="text-lg">{formatDate(position.entryDate)}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Maturité</h4>
                    <p className="text-lg">{formatDate(position.maturityDate)}</p>
                    <p className="text-sm text-muted-foreground">
                      {getRemainingTime(position.maturityDate)}
                    </p>
                  </div>
                  <div className="flex items-center justify-end">
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        className="border-blue-900"
                      >
                        Mettre en vente
                      </Button>
                      <Button
                        onClick={() => handleExitStrategy(index + 1)}
                        disabled={isPending || Number(position.maturityDate) * 1000 > Date.now()}
                        variant="destructive"
                      >
                        {isPending ? "Transaction en cours..." : "Sortir de la position"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          ))
        ) : (
          <div className="p-6 bg-card rounded-lg border text-center">
            <p className="text-muted-foreground">Aucune position active</p>
          </div>
        )}
      </div>
    </div>
  );
} 