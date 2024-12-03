"use client"

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useWriteContract, useReadContract } from 'wagmi';
import { contractAddresses, contractABIs } from "@/app/config/contracts";
import { useRole } from "@/hooks/useRole";
import { useTransactionToast } from "@/hooks/use-transaction-toast";
import Link from "next/link";
import { ArrowLeft, BookText } from "lucide-react";

const PT_TOKEN_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

const StrategyOnePage = () => {
    // Récupération du role
    const { role } = useRole();

    // State pour le montant
    const [amount, setAmount] = useState<string>('');

    // Écriture du contrat avec hook wagmi
    const { writeContract, data: hash, error, isPending } = useWriteContract();

    // Utilisation du hook de toast perso pour suivre la transaction
    useTransactionToast(hash, error);

    // Fonction pour approuver les tokens
    const handleApprove = async () => {
        if (!amount) return;

        const amountInWei = BigInt(parseFloat(amount) * 1e6);

        writeContract({
            address: contractAddresses.gUSDC,
            abi: contractABIs.gUSDC,
            functionName: 'approve',
            args: [contractAddresses.strategyOne, amountInWei],
        });
    };

    // Fonction pour entrer dans la stratégie A
    const handleEnterStrategy = async () => {
        if (role !== "CLIENT" || !amount) return;

        const amountInWei = BigInt(parseFloat(amount) * 1e6);

        writeContract({
            address: contractAddresses.strategyOne,
            abi: contractABIs.strategyOne,
            functionName: 'enterStrategy',
            args: [amountInWei],
        });
    };

    // lecture des éléments de la stratégie
    const [currentDuration, setCurrentDuration] = useState<string>('');
    const [currentYield, setCurrentYield] = useState<string>('');

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

    // Mise à jour des valeurs lues via useEffect
    useEffect(() => {
        if (yieldData) setCurrentYield(yieldData.toString());
        if (durationData) {
            // Conversion des secondes en jours
            const durationInDays = Math.floor(Number(durationData) / (24 * 60 * 60));
            setCurrentDuration(durationInDays.toString());
        }
    }, [yieldData, durationData]);

    return (
        <>
            {/* Conteneur pour le bouton retour et le bouton retour vers la page d'accueil */}
            <div className="container mx-auto p-4 flex flex-col sm:flex-row gap-4">
                <Link href="/dapp">
                    <Button 
                        variant="secondary" 
                        className="w-full sm:w-auto flex items-center gap-2 group hover:bg-accent"
                    >
                        <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
                        Vers Stratégies
                    </Button>
                </Link>
                {/* Bouton learn how to swap */}
                <Link href="/learn/swap">
                    <Button 
                        variant="outline"
                        className="w-full sm:w-auto flex items-center gap-2 group hover:bg-accent border-green-600"
                    >
                        <BookText className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-1" />
                        Comment obtenir des gUSDC ?
                    </Button>
                </Link>
            </div>
            <h2 className="text-2xl font-bold mb-4">Stratégie A : Yield fixe sur une période donnée</h2>
            {currentYield && currentDuration && (
                <div className="space-y-2 p-4 bg-muted rounded-lg">
                    <div>
                        <span className="text-sm text-muted-foreground">Token utilisé pour la stratégie :</span>
                        <p className="font-semibold">gUSDC (Gains network)</p>
                    </div>
                    <div>
                        <span className="text-sm text-muted-foreground">Yield actuel (Rendement annuel) :</span>
                        <p className="font-semibold">{currentYield}%</p>
                    </div>
                    <div>
                        <span className="text-sm text-muted-foreground">Durée de la stratégie:</span>
                        <p className="font-semibold">{currentDuration} jours</p>
                    </div>
                    <div>
                        <span className="text-sm text-muted-foreground">Date de maturité de la stratégie :</span>
                        <p className="font-semibold">{new Date(Date.now() + Number(currentDuration) * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
                    </div>
                </div>
            )}
            <div className="container mx-auto p-4">
                <Input 
                    className="mb-8 w-full md:w-1/4" 
                    type="number" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    placeholder="Entrer un montant en gUSDC" 
                    disabled={role !== "CLIENT"}
                />
                <div className="flex flex-col sm:flex-row gap-4">
                    <Button 
                        onClick={handleApprove}
                        disabled={role !== "CLIENT"}
                        variant={role === "CLIENT" ? "outline" : "secondary"}
                        className="w-full sm:w-auto"
                    >
                        {isPending ? "Approbation en cours..." : "1. Approuver les gUSDC"}
                    </Button>
                    <Button 
                        onClick={handleEnterStrategy}
                        disabled={role !== "CLIENT"}
                        variant={role === "CLIENT" ? "default" : "secondary"}
                        className="w-full sm:w-auto"
                    >
                        {isPending ? "Transaction en cours..." : "2. Entrer dans la stratégie"}
                    </Button>
                    <Link href="/dapp/mapage">
                        <Button 
                            variant="outline"
                            className="w-full sm:w-auto border-green-600"
                        >
                            3. Voir ma position
                        </Button>
                    </Link>
                </div>
            </div>
        </>
    )
}

export default StrategyOnePage;
