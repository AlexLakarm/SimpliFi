"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useReadContract } from 'wagmi';
import { contractAddresses, contractABIs } from "@/app/config/contracts";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PT_TOKEN_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

export default function StrategyPage() {
  const router = useRouter();
  const { role } = useRole();
  const [currentYield, setCurrentYield] = useState<string>('');
  const [currentDuration, setCurrentDuration] = useState<string>('');

  // Lecture du yield
  const { data: yieldData } = useReadContract({
    address: contractAddresses.oracle,
    abi: contractABIs.oracle,
    functionName: 'getYield',
    args: [PT_TOKEN_ADDRESS as `0x${string}`],
  });

  // Lecture de la durée
  const { data: durationData } = useReadContract({
    address: contractAddresses.oracle,
    abi: contractABIs.oracle,
    functionName: 'getDuration',
    args: [PT_TOKEN_ADDRESS as `0x${string}`],
  });

  // Mise à jour des valeurs lues
  useEffect(() => {
    if (yieldData) setCurrentYield(yieldData.toString());
    if (durationData) {
      // Conversion des secondes en jours
      const durationInDays = Math.floor(Number(durationData) / (24 * 60 * 60));
      setCurrentDuration(durationInDays.toString());
    }
  }, [yieldData, durationData]);

  return (
    <div className="container mx-auto p-4 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">
          Accédez au meilleur de la DeFi via des stratégies sélectionnées pour vous
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stratégie A */}
        <Card className="gradient-border">
          <CardHeader>
            <CardTitle>Stratégie A</CardTitle>
            <CardDescription>
              Placer du stable coin avec un yield fixe sur une période donnée.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Chaque prise de position sera représentée par un NFT envoyé dans votre wallet, 
              NFT que vous pourrez mettre en vente sur la marketplace si vous souhaitez sortir 
              de façon anticipée.
            </p>
            {currentYield && currentDuration && (
              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <div>
                  <span className="text-sm text-muted-foreground">Yield actuel (Rendement annuel) :</span>
                  <p className="font-semibold">{currentYield}%</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Durée de la stratégie:</span>
                  <p className="font-semibold">{currentDuration} jours</p>
                </div>
              </div>
            )}
            <Button 
              className="w-full"
              onClick={() => router.push('/dapp/strategyone')}
              disabled={!role || role === "NO_ROLE"}
            >
              {!role || role === "NO_ROLE" ? "Contactez-nous pour accéder à la stratégie" : "Accéder à la stratégie"}
            </Button>
          </CardContent>
        </Card>

        {/* Stratégie B */}
        <Card>
          <CardHeader>
            <CardTitle>Stratégie B</CardTitle>
            <CardDescription>
              Coming soon
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              De nouvelles stratégies seront bientôt disponibles...
            </p>
          </CardContent>
        </Card>

        {/* Stratégie C */}
        <Card>
          <CardHeader>
            <CardTitle>Stratégie C</CardTitle>
            <CardDescription>
              Coming soon
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              De nouvelles stratégies seront bientôt disponibles...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}