"use client"

import { useEffect, useState } from "react";
import { usePublicClient, useWriteContract, useAccount } from 'wagmi';
import { contractAddresses, contractABIs } from '@/app/config/contracts';
import { Button } from "@/components/ui/button";
import { useTransactionToast } from "@/hooks/use-transaction-toast";
import { ArrowLeft } from "lucide-react";

export default function CGPFees() {
  const { address } = useAccount();
  const [fees, setFees] = useState<bigint>(BigInt(0));
  const publicClient = usePublicClient();
  const { writeContract, data: hash, error } = useWriteContract();

  // Hook pour les toasts de transaction
  useTransactionToast(hash, error);

  useEffect(() => {
    const fetchFees = async () => {
      if (!publicClient || !address) return;

      try {
        const fees = await publicClient.readContract({
          address: contractAddresses.strategyOne,
          abi: contractABIs.strategyOne,
          functionName: 'cgpFees',
          args: [address]
        }) as readonly [bigint, bigint, bigint];

        // Somme des frais non matures et matures non retirés
        setFees(fees[0] + fees[1]);
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
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => window.history.back()}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Button>

      <div className="p-6 bg-card rounded-lg border space-y-4">
        <h3 className="text-lg font-semibold">Frais CGP</h3>
        <p className="text-2xl font-bold">{Number(fees) / 1e6} gUSDC</p>
        <Button
          onClick={handleWithdraw}
          disabled={fees <= BigInt(0)}
          className="w-full"
        >
          Retirer les frais
        </Button>
      </div>
    </div>
  );
} 