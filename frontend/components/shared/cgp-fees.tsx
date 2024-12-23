"use client"

import { useEffect, useState } from "react";
import { usePublicClient, useWriteContract, useAccount } from 'wagmi';
import { contractAddresses, contractABIs } from '@/app/config/contracts';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTransactionToast } from "@/hooks/use-transaction-toast";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CGPFees() {
  const { address } = useAccount();
  const [nonMaturedFees, setNonMaturedFees] = useState<bigint>(BigInt(0));
  const [maturedNonWithdrawnFees, setMaturedNonWithdrawnFees] = useState<bigint>(BigInt(0));
  const [withdrawnFees, setWithdrawnFees] = useState<bigint>(BigInt(0));
  const publicClient = usePublicClient();
  const { writeContract, data: hash, error } = useWriteContract();

  // Hook pour les toasts de transaction
  useTransactionToast(hash, error);

  useEffect(() => {
    const fetchFees = async () => {
      if (!publicClient || !address) return;

      try {
        const [nonMatured, maturedNonWithdrawn, withdrawn] = await publicClient.readContract({
          address: contractAddresses.strategyOne,
          abi: contractABIs.strategyOne,
          functionName: 'cgpFees',
          args: [address]
        }) as readonly [bigint, bigint, bigint];

        setNonMaturedFees(nonMatured);
        setMaturedNonWithdrawnFees(maturedNonWithdrawn);
        setWithdrawnFees(withdrawn);
      } catch (error) {
        console.error('Erreur lors de la récupération des frais:', error);
      }
    };

    fetchFees();
  }, [publicClient, address]);

  const handleWithdraw = async () => {
    try {
      await writeContract({
        address: contractAddresses.strategyOne,
        abi: contractABIs.strategyOne,
        functionName: 'withdrawCGPFees',
      });
    } catch (error) {
      console.error('Erreur lors du retrait des frais:', error);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-2">
        <Link href="/dapp/mapage">
          <Button
            variant="outline" 
            size="sm"
            className="flex items-center gap-2 group hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Retour
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Gestion des frais CGP</CardTitle>
          <CardDescription>
            <span className="text-sm text-muted-foreground">
              Le bouton &quot;Retirer&quot; apparait uniquement lorsque les frais à maturité sont disponibles.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex justify-between items-center p-4 border rounded">
              <div>
                <h3 className="text-lg font-medium">Frais non arrivés à maturité</h3>
                <p className="text-2xl font-bold">{Number(nonMaturedFees) / 1e6} gUSDC</p>
              </div>
            </div>
            <div className="flex justify-between items-center p-4 border rounded">
              <div>
                <h3 className="text-lg font-medium">Frais à maturité disponibles</h3>
                <p className="text-2xl font-bold">{Number(maturedNonWithdrawnFees) / 1e6} gUSDC</p>
              </div>
              {maturedNonWithdrawnFees > BigInt(0) && (
                <Button
                  onClick={handleWithdraw}
                  disabled={maturedNonWithdrawnFees <= BigInt(0)}
                >
                  Retirer
                </Button>
              )}
            </div>
            <div className="flex justify-between items-center p-4 border rounded">
              <div>
                <h3 className="text-lg font-medium">Frais déjà retirés</h3>
                <p className="text-2xl font-bold">{Number(withdrawnFees) / 1e6} gUSDC</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 