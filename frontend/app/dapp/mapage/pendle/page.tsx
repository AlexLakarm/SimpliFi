"use client"

import { useState, useEffect, useCallback } from "react";
import { useWriteContract, useReadContract } from 'wagmi';
import { contractAddresses, contractABIs } from "@/app/config/contracts";
import { isAddress } from 'viem';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRole } from "@/hooks/useRole";
import { useTransactionToast } from "@/hooks/use-transaction-toast";

const PendlePage = () => {
    const { role } = useRole(); // hook personnalisé pour gérer les rôles
    // States
    const [isClient, setIsClient] = useState(false);
    const [ptTokenAddress, setPtTokenAddress] = useState('');
    const [yieldValue, setYieldValue] = useState('');
    const [duration, setDuration] = useState('');

    // États pour les valeurs lues dans le contrat mock oracle
    const [ptRate, setPtRate] = useState<string>('');
    const [currentYield, setCurrentYield] = useState<string>('');
    const [currentDuration, setCurrentDuration] = useState<string>('');

    useEffect(() => {
        setIsClient(true);
    }, []);

    // Écriture du contrat avec hook wagmi
    const { writeContract, data: hash, error, isPending } = useWriteContract();

    // Lecture des valeurs dans le contrat mock oracle avec hook wagmi
    const { data: ptRateData, refetch: refetchPtRate } = useReadContract({
        address: contractAddresses.oracle,
        abi: contractABIs.oracle,
        functionName: 'getPTRate',
        args: ptTokenAddress && isAddress(ptTokenAddress) ? [ptTokenAddress as `0x${string}`] : undefined,
        query: {
            enabled: Boolean(ptTokenAddress && isAddress(ptTokenAddress))
        }
    });

    const { data: yieldData, refetch: refetchYield } = useReadContract({
        address: contractAddresses.oracle,
        abi: contractABIs.oracle,
        functionName: 'getYield',
        args: ptTokenAddress && isAddress(ptTokenAddress) ? [ptTokenAddress as `0x${string}`] : undefined, // args pour la fonction getYield
        query: {
            enabled: Boolean(ptTokenAddress && isAddress(ptTokenAddress))
        }
    });

    const { data: durationData, refetch: refetchDuration } = useReadContract({
        address: contractAddresses.oracle,
        abi: contractABIs.oracle,
        functionName: 'getDuration',
        args: ptTokenAddress && isAddress(ptTokenAddress) ? [ptTokenAddress as `0x${string}`] : undefined,
        query: {
            enabled: Boolean(ptTokenAddress && isAddress(ptTokenAddress))
        }
    });

    // Utilisation du hook de toast perso pour suivre la transaction
    const { isSuccess } = useTransactionToast(hash, error);

    // Fonction pour gérer setRateAndPrice
    const handleSetRateAndPrice = async () => {
        if (!ptTokenAddress || !isAddress(ptTokenAddress) || !yieldValue) return;

        writeContract({
            address: contractAddresses.oracle,
            abi: contractABIs.oracle,
            functionName: 'setRateAndPrice',
            args: [ptTokenAddress as `0x${string}`, BigInt(yieldValue)],
        });
    };

    // Fonction pour gérer setDuration
    const handleSetDuration = async () => {
        if (!ptTokenAddress || !isAddress(ptTokenAddress) || !duration) return;

        // Conversion des jours en secondes pour le contrat
        const durationInSeconds = BigInt(Number(duration) * 24 * 60 * 60);

        writeContract({
            address: contractAddresses.oracle,
            abi: contractABIs.oracle,
            functionName: 'setDuration',
            args: [ptTokenAddress as `0x${string}`, durationInSeconds],
        });
    };

    // Fonction pour rafraîchir les valeurs
    const refreshValues = useCallback(() => {
        if (ptTokenAddress && isAddress(ptTokenAddress)) {
            refetchPtRate();
            refetchYield();
            refetchDuration();
        }
    }, [ptTokenAddress, refetchPtRate, refetchYield, refetchDuration]);

    // Mise à jour des valeurs lues
    useEffect(() => {
        if (ptRateData) setPtRate(ptRateData.toString());
        if (yieldData) setCurrentYield(yieldData.toString());
        if (durationData) {
            // Conversion des secondes en jours
            const durationInDays = Math.floor(Number(durationData) / (24 * 60 * 60));
            setCurrentDuration(durationInDays.toString());
        }
    }, [ptRateData, yieldData, durationData]);

    // Rafraîchir les valeurs après une transaction réussie
    useEffect(() => {
        if (isSuccess) {
            refreshValues();
        }
    }, [isSuccess, refreshValues]);

    return (
        <div className="container mx-auto p-4 space-y-6">
            {isClient && role !== 'ADMIN' && (
                <div className="fixed top-20 left-4 w-full max-w-sm">
                    <div className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md">
                        Accès restreint aux administrateurs
                    </div>
                </div>
            )}

            <h2 className="text-3xl font-bold tracking-tight">Mock Pendle Management</h2>

            <div className="p-4 md:p-6 bg-card rounded-lg border-2 border-destructive space-y-8">
                {/* Section commune pour l'adresse du token */}
                <div className="space-y-4">
                    <h4 className="font-semibold">Rechercher les valeurs actuelles de Yield, Rate et Duration pour un PT token</h4>
                    <p className="text-sm text-muted-foreground">PT gusdc actuellement déployé sur Holesky : 0xd5F274E114b72E7DA9a92e89885E79EA030dc112</p>
                    <div className="flex gap-4">
                        <Input
                            placeholder="PT Token Address"
                            value={ptTokenAddress}
                            onChange={(e) => setPtTokenAddress(e.target.value)}
                            className="flex-1"
                        />
                        <Button
                            variant="secondary"
                            onClick={refreshValues}
                            disabled={!ptTokenAddress || !isAddress(ptTokenAddress)}
                        >
                            Rafraîchir
                        </Button>
                    </div>
                </div>

                {/* Section des valeurs actuelles */}
                {ptTokenAddress && isAddress(ptTokenAddress) && (
                    <div className="grid gap-4 p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold">Valeurs actuelles</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <span className="text-sm text-muted-foreground">PT Rate:</span>
                                <div className="font-mono">{ptRate || 'Non défini'}</div>
                            </div>
                            <div>
                                <span className="text-sm text-muted-foreground">Yield:</span>
                                <div className="font-mono">{currentYield ? `${currentYield}%` : 'Non défini'}</div>
                            </div>
                            <div>
                                <span className="text-sm text-muted-foreground">Duration:</span>
                                <div className="font-mono">{currentDuration ? `${currentDuration} jours` : 'Non défini'}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Section setRateAndPrice */}
                <div className="space-y-4">
                    <h4 className="font-semibold">Set Yield (Rate calculé automatiquement)</h4>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            placeholder="Yield (ex: 10 pour 10%)"
                            value={yieldValue}
                            onChange={(e) => setYieldValue(e.target.value)}
                            className="flex-1"
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">points (%)</span>
                    </div>
                    <Button 
                        onClick={handleSetRateAndPrice}
                        disabled={isPending || !ptTokenAddress || !isAddress(ptTokenAddress) || !yieldValue}
                        className="w-full"
                    >
                        {isPending ? "Transaction en cours..." : "Set Rate and Price"}
                    </Button>
                </div>

                {/* Section setDuration */}
                <div className="space-y-4">
                    <h4 className="font-semibold">Set Duration</h4>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            placeholder="Duration"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            className="flex-1"
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">jours</span>
                    </div>
                    <Button 
                        onClick={handleSetDuration}
                        disabled={isPending || !ptTokenAddress || !isAddress(ptTokenAddress) || !duration}
                        className="w-full"
                    >
                        {isPending ? "Transaction en cours..." : "Set Duration"}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default PendlePage;