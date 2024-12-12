"use client"

import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { contractAddresses, contractABIs } from "@/app/config/contracts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccount } from "wagmi";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CGPFees() {
  const { address } = useAccount();
  const [cgpPendingFees, setCgpPendingFees] = useState<bigint>(BigInt(0));
  const [cgpWithdrawnFees, setCgpWithdrawnFees] = useState<bigint>(BigInt(0));

  const { data: cgpFees } = useReadContract({
    address: contractAddresses.strategyOne,
    abi: contractABIs.strategyOne,
    functionName: "cgpFees",
    args: [address as `0x${string}`],
  });

  useEffect(() => {
    if (cgpFees) {
      const [nonMaturedFees, maturedNonWithdrawnFees, withdrawnFees] = cgpFees;
      const totalPendingFees = nonMaturedFees + maturedNonWithdrawnFees;
      setCgpPendingFees(totalPendingFees);
      setCgpWithdrawnFees(withdrawnFees);
    }
  }, [cgpFees]);

  return (
    <div className="container mx-auto p-4">
              <Link href="/dapp/mapage">
            <Button 
              variant="outline" 
              size="sm"
              className="flex items-center gap-2 group hover:bg-accent mt-14"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <Retour></Retour>
            </Button>
          </Link>
      <Card>
        <CardHeader>
          <CardTitle>Gestion de vos frais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex justify-between items-center p-4 border rounded">
              <div>
                <h3 className="text-lg font-medium">Frais en attente</h3>
                <p className="text-2xl font-bold">{Number(cgpPendingFees) / 1e6} gUSDC</p>
              </div>
              <Button>Retirer</Button>
            </div>
            <div className="flex justify-between items-center p-4 border rounded">
              <div>
                <h3 className="text-lg font-medium">Frais déjà retirés</h3>
                <p className="text-2xl font-bold">{Number(cgpWithdrawnFees) / 1e6} gUSDC</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 