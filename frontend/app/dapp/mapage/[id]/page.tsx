"use client"

import { useState, useEffect } from "react";
import { useReadContract, useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { contractAddresses, contractABIs } from "@/app/config/contracts";
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTransactionToast } from "@/hooks/use-transaction-toast";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { use } from 'react';

type Position = {
  gUSDCAmount: bigint;
  ptAmount: bigint;
  entryDate: bigint;
  maturityDate: bigint;
  exitDate: bigint;
  isActive: boolean;
};

type NFTSale = {
  salePrice: bigint;
  isOnSale: boolean;
};

export default function PositionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const strategyId = Number(resolvedParams.id);
  const { address } = useAccount();
  const [position, setPosition] = useState<Position | null>(null);
  const [nftId, setNftId] = useState<number | null>(null);
  const [positionId, setPositionId] = useState<number | null>(null);
  const [salePrice, setSalePrice] = useState<string>("");
  const [saleInfo, setSaleInfo] = useState<NFTSale | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const router = useRouter();
  const publicClient = usePublicClient();

  // Hooks pour les transactions
  const { writeContract, data: hash, error } = useWriteContract();

  // Hook pour les toasts de transaction
  useTransactionToast(hash, error);

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

  // Lecture des NFTs de l'utilisateur
  const { data: userNFTs } = useReadContract({
    address: contractAddresses.strategyNFT,
    abi: contractABIs.strategyNFT,
    functionName: 'getTokensOfOwner',
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address)
    }
  });

  // Mise à jour de la position et des IDs
  useEffect(() => {
    if (userPositions && userNFTs) {
      const positionsArray = userPositions as unknown as Position[];
      const nftIds = userNFTs as bigint[];
      
      // Trouver l'index de la position qui correspond au NFT
      const positionIndex = Number(strategyId);
      const nftIdNumber = Number(nftIds[positionIndex]);
      
      console.log('Position mapping:', {
        strategyId,
        nftIdNumber,
        positionIndex,
        allNftIds: nftIds.map(id => Number(id)),
        positionsLength: positionsArray.length,
        userPositions: positionsArray,
      });

      if (positionIndex < positionsArray.length) {
        setPosition(positionsArray[positionIndex]);
        setNftId(nftIdNumber);
        setPositionId(nftIdNumber - 1);
      }
    }
  }, [userPositions, userNFTs, strategyId]);

  // Effet pour charger le statut de vente
  useEffect(() => {
    const loadSaleInfo = async () => {
      if (positionId === null || !publicClient) return;

      try {
        const saleData = await publicClient.readContract({
          address: contractAddresses.strategyOne,
          abi: contractABIs.strategyOne,
          functionName: 'nftSales',
          args: [BigInt(positionId)],
        }) as [bigint, boolean];

        const [price, isOnSale] = saleData;
        console.log('Sale status:', {
          positionId,
          nftId,
          price: price.toString(),
          isOnSale
        });
        setSaleInfo({ salePrice: price, isOnSale });
      } catch (error) {
        console.error('Erreur lors de la lecture du statut de vente:', error);
      }
    };

    loadSaleInfo();
  }, [positionId, publicClient, nftId]);

  // Lecture de l'approbation globale
  const { data: isApprovedForAll, refetch: refetchApproval } = useReadContract({
    address: contractAddresses.strategyNFT,
    abi: contractABIs.strategyNFT,
    functionName: 'isApprovedForAll',
    args: address ? [address, contractAddresses.strategyOne] : undefined,
    query: {
      enabled: Boolean(address)
    }
  });

  // Effet pour mettre à jour l'état après une transaction
  useEffect(() => {
    if (hash) {
      const checkTransaction = async () => {
        try {
          await publicClient?.waitForTransactionReceipt({ hash });
          console.log('Transaction confirmée:', hash);
          // Rafraîchir l'état d'approbation
          await refetchApproval();
          // Rafraîchir le statut de vente
          const loadSaleInfo = async () => {
            if (!nftId || !publicClient) return;
            try {
              const saleData = await publicClient.readContract({
                address: contractAddresses.strategyOne,
                abi: contractABIs.strategyOne,
                functionName: 'nftSales',
                args: [BigInt(strategyId)],
              }) as [bigint, boolean];
              const [price, isOnSale] = saleData;
              setSaleInfo({ salePrice: price, isOnSale });
            } catch (error) {
              console.error('Erreur lors de la lecture du statut de vente:', error);
            }
          };
          loadSaleInfo();
        } catch (error) {
          console.error('Erreur lors de la vérification de la transaction:', error);
        }
      };
      checkTransaction();
    }
  }, [hash, publicClient, nftId, refetchApproval]);

  // Fonction pour approuver
  const handleApprove = async () => {
    if (!position || !nftId) return;

    try {
      setIsPending(true);
      console.log('Demande d\'approbation pour NFT #', nftId);
      
      await writeContract({
        address: contractAddresses.strategyNFT,
        abi: contractABIs.strategyNFT,
        functionName: 'setApprovalForAll',
        args: [contractAddresses.strategyOne, true],
      });
    } catch (error) {
      console.error('Erreur lors de l\'approbation:', error);
    } finally {
      setIsPending(false);
    }
  };

  // Fonction pour mettre en vente
  const handleListForSale = async () => {
    if (!salePrice || positionId === null || !isApprovedForAll || !address || !publicClient) {
      console.log('Conditions non remplies:', {
        salePrice,
        positionId,
        nftId,
        isApprovedForAll,
        address,
        publicClient: !!publicClient
      });
      return;
    }

    try {
      setIsPending(true);
      const priceInWei = BigInt(parseFloat(salePrice) * 1e6);
      
      console.log('Mise en vente:', {
        positionId,
        nftId,
        price: priceInWei.toString(),
        isApprovedForAll
      });

      await writeContract({
        address: contractAddresses.strategyOne,
        abi: contractABIs.strategyOne,
        functionName: 'listNFTForSale',
        args: [BigInt(positionId), priceInWei],
      });

      setSalePrice("");
    } catch (error) {
      console.error('Erreur lors de la mise en vente:', error);
      if (error instanceof Error) {
        console.error('Message d\'erreur:', error.message);
        console.error('Stack trace:', error.stack);
      }
    } finally {
      setIsPending(false);
    }
  };

  // Fonction pour annuler la vente
  const handleCancelSale = async () => {
    if (!positionId) return;

    try {
      setIsPending(true);
      console.log('Annulation de la vente:', {
        positionId,
        nftId
      });

      await writeContract({
        address: contractAddresses.strategyOne,
        abi: contractABIs.strategyOne,
        functionName: 'cancelNFTSale',
        args: [BigInt(positionId)],
      });
    } catch (error) {
      console.error('Erreur lors de l\'annulation de la vente:', error);
    } finally {
      setIsPending(false);
    }
  };

  // Fonction pour sortir de la stratégie
  const handleExitStrategy = async () => {
    if (!positionId) return;

    try {
      setIsPending(true);
      console.log('Sortie de la stratégie:', {
        positionId,
        nftId
      });

      await writeContract({
        address: contractAddresses.strategyOne,
        abi: contractABIs.strategyOne,
        functionName: 'exitStrategy',
        args: [BigInt(positionId)],
      });
    } catch (error) {
      console.error('Erreur lors de la sortie de la stratégie:', error);
    } finally {
      setIsPending(false);
    }
  };

  // Fonction pour formater les montants
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

  if (!position) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <h2 className="text-3xl font-bold tracking-tight">Position NFT Id#{nftId}</h2>
      </div>

      <div className="grid gap-6">
        <div className="p-6 bg-card rounded-lg border space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Montant Initial</h4>
              <p className="text-2xl font-bold">{formatAmount(position.gUSDCAmount)} gUSDC</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Montant à Maturité</h4>
              <p className="text-2xl font-bold">{formatAmount(position.ptAmount)} gUSDC</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Date d&apos;Entrée</h4>
              <p className="text-base">{formatDate(position.entryDate)}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Maturité</h4>
              <p className="text-base">{formatDate(position.maturityDate)}</p>
              <p className="text-sm text-muted-foreground">
                {getRemainingTime(position.maturityDate)}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="text-lg font-semibold mb-4">Gestion de la Position</h4>
            <div className="space-y-4">
              {saleInfo?.isOnSale ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Prix de vente actuel:</span>
                    <span className="font-semibold">{formatAmount(saleInfo.salePrice)} gUSDC</span>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full border-orange-600 text-orange-600"
                    onClick={handleCancelSale}
                    disabled={isPending}
                  >
                    {isPending ? "Transaction..." : "Annuler la vente"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Prix en gUSDC"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      className="flex-1"
                    />
                    {!isApprovedForAll ? (
                      <Button
                        variant="outline"
                        className="border-blue-900"
                        onClick={handleApprove}
                        disabled={isPending}
                      >
                        {isPending ? "Approbation..." : "Approuver"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="border-blue-900"
                        onClick={handleListForSale}
                        disabled={!salePrice || isPending}
                      >
                        {isPending ? "Transaction..." : "Mettre en vente"}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <Button
                onClick={handleExitStrategy}
                disabled={isPending || Number(position?.maturityDate) * 1000 > Date.now()}
                variant="destructive"
                className="w-full"
              >
                {isPending ? "Transaction..." : "Sortir de la position"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 