"use client"

import { useState, useEffect, useCallback } from "react";
import { useReadContract, useAccount, useWriteContract, usePublicClient, useTransactionConfirmations } from 'wagmi';
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

function PositionPageContent({ id }: { id: string }) {
  const strategyId = Number(id);
  const { address } = useAccount();
  const [position, setPosition] = useState<Position | null>(null);
  const [nftId, setNftId] = useState<number | null>(null);
  const [positionId, setPositionId] = useState<number | null>(null);
  const [salePrice, setSalePrice] = useState<string>("");
  const [saleInfo, setSaleInfo] = useState<NFTSale | null>(null);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();
  const publicClient = usePublicClient();

  // Hooks pour les transactions
  const { writeContract, data: hash, error } = useWriteContract();

  // Hook pour les toasts de transaction
  useTransactionToast(hash, error);

  // Suivre les confirmations de transaction
  const { data: confirmations } = useTransactionConfirmations({
    hash,
  });

  // Effet pour rafraîchir après confirmation
  useEffect(() => {
    if (confirmations === BigInt(1)) {
      refreshSaleStatus();
      // Recharger aussi les approbations
      if (address) {
        checkApprovals();
      }
    }
  }, [confirmations]);

  // Fonction pour rafraîchir le statut de vente
  const refreshSaleStatus = useCallback(async () => {
    if (positionId === null || !publicClient) return;

    try {
      const saleData = await publicClient.readContract({
        address: contractAddresses.strategyOne,
        abi: contractABIs.strategyOne,
        functionName: 'nftSales',
        args: [BigInt(positionId)],
      }) as [bigint, boolean];

      const [price, isOnSale] = saleData;
      console.log('Statut de vente rafraîchi:', { price: price.toString(), isOnSale });
      setSaleInfo({ salePrice: price, isOnSale });
    } catch (error) {
      console.error('Erreur lors du rafraîchissement du statut de vente:', error);
    }
  }, [positionId, publicClient]);

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

  // Fonction pour vérifier les approbations
  const checkApprovals = useCallback(async () => {
    if (!address || !publicClient) return;
    await refetchApproval();
  }, [address, publicClient, refetchApproval]);

  // Effet pour charger le statut de vente initial
  useEffect(() => {
    refreshSaleStatus();
  }, [refreshSaleStatus]);

  // Effet pour écouter les événements de vente
  useEffect(() => {
    if (!publicClient || positionId === null) return;

    const unwatchListed = publicClient.watchContractEvent({
      address: contractAddresses.strategyOne,
      abi: contractABIs.strategyOne,
      eventName: 'NFTListedForSale',
      onLogs: async (logs) => {
        console.log('Événement NFTListedForSale détecté:', logs);
        
        for (const log of logs) {
          if (log.args && Number(log.args.NFTid) === positionId) {
            await refreshSaleStatus();
            break;
          }
        }
      }
    });

    const unwatchCanceled = publicClient.watchContractEvent({
      address: contractAddresses.strategyOne,
      abi: contractABIs.strategyOne,
      eventName: 'NFTSaleCanceled',
      onLogs: async (logs) => {
        console.log('Événement NFTSaleCanceled détecté:', logs);
        
        for (const log of logs) {
          if (log.args && Number(log.args.NFTid) === positionId) {
            await refreshSaleStatus();
            break;
          }
        }
      }
    });

    const unwatchSold = publicClient.watchContractEvent({
      address: contractAddresses.strategyOne,
      abi: contractABIs.strategyOne,
      eventName: 'NFTSold',
      onLogs: async (logs) => {
        console.log('Événement NFTSold détecté:', logs);
        
        for (const log of logs) {
          if (log.args && Number(log.args.NFTid) === positionId) {
            await refreshSaleStatus();
            break;
          }
        }
      }
    });

    return () => {
      unwatchListed();
      unwatchCanceled();
      unwatchSold();
    };
  }, [publicClient, positionId, refreshSaleStatus]);

  // Lecture des positions de l'utilisateur
  const { data: userPositions, isLoading: isLoadingPositions } = useReadContract({
    address: contractAddresses.strategyOne,
    abi: contractABIs.strategyOne,
    functionName: 'getUserPositions',
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address)
    }
  });

  // Lecture des NFTs de l'utilisateur
  const { data: userNFTs, isLoading: isLoadingNFTs } = useReadContract({
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
    console.log('useEffect déclenché avec:', {
      userPositions,
      userNFTs,
      strategyId,
      address,
      isLoadingPositions,
      isLoadingNFTs
    });

    if (!address) {
      console.log('Pas d\'adresse connectée');
      return;
    }

    if (isLoadingPositions || isLoadingNFTs) {
      console.log('Chargement des données en cours...');
      return;
    }

    if (userPositions && userNFTs) {
      const positionsArray = userPositions as unknown as Position[];
      const nftIds = userNFTs as bigint[];
      
      console.log('Données chargées:', {
        positionsArray,
        nftIds: nftIds.map(id => Number(id)),
        strategyId
      });

      // Trouver le NFT correspondant au strategyId
      const nftIdBigInt = nftIds.find(id => Number(id) === strategyId);
      
      if (!nftIdBigInt) {
        console.log('NFT non trouvé pour l\'ID:', strategyId);
        return;
      }

      // Trouver l'index de la position correspondante
      const positionIndex = nftIds.findIndex(id => Number(id) === strategyId);
      
      console.log('Position mapping:', {
        strategyId,
        nftId: Number(nftIdBigInt),
        positionIndex,
        allNftIds: nftIds.map(id => Number(id)),
        positionsLength: positionsArray.length,
      });

      if (positionIndex !== -1 && positionIndex < positionsArray.length) {
        setPosition(positionsArray[positionIndex]);
        setNftId(Number(nftIdBigInt));
        setPositionId(Number(nftIdBigInt) - 1);
        console.log('Position trouvée et états mis à jour');
      } else {
        console.log('Position non trouvée dans le tableau');
      }
    }
  }, [userPositions, userNFTs, strategyId, address, isLoadingPositions, isLoadingNFTs]);

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

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <p className="text-lg text-muted-foreground">
          Veuillez connecter votre portefeuille
        </p>
      </div>
    );
  }

  if (isLoadingPositions || isLoadingNFTs) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <p className="text-lg text-muted-foreground">
          Chargement de vos positions...
        </p>
      </div>
    );
  }

  if (!position) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <p className="text-lg text-muted-foreground">
          Position non trouvée
        </p>
      </div>
    );
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

export default function PositionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  return <PositionPageContent id={resolvedParams.id} />;
} 