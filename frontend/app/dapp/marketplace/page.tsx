"use client"

import { useEffect, useState } from 'react';
import { useAccount, usePublicClient, useWriteContract, useTransactionConfirmations } from 'wagmi';
import { contractAddresses, contractABIs } from '@/app/config/contracts';
import { Position } from '@/app/types';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { useTransactionToast } from "@/hooks/use-transaction-toast";

type PositionForSale = {
  position: Position;
  NFTid: bigint;
  salePrice: bigint;
};

export default function Marketplace() {
  const [positionsForSale, setPositionsForSale] = useState<PositionForSale[]>([]);
  const [isPending, setIsPending] = useState(false);
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContract, data: hash, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useTransactionConfirmations({ hash });

  // Hook pour les toasts de transaction
  useTransactionToast(hash, error);

  const fetchPositionsForSale = async () => {
    if (!publicClient) return;

    try {
      const totalPositions = await publicClient.readContract({
        address: contractAddresses.strategyOne,
        abi: contractABIs.strategyOne,
        functionName: 'getAllActivePositionsCount',
      }) as bigint;

      console.log('Total positions:', Number(totalPositions));
      const newPositionsForSale = [];

      for (let i = 0; i < Number(totalPositions); i++) {
        // Récupérer d'abord la position pour vérifier si elle est active
        const positionData = await publicClient.readContract({
          address: contractAddresses.strategyOne,
          abi: contractABIs.strategyOne,
          functionName: 'allPositions',
          args: [BigInt(i)],
        }) as readonly [bigint, bigint, bigint, bigint, bigint, boolean, bigint, `0x${string}`];

        const position: Position = {
          gUSDCAmount: positionData[0],
          ptAmount: positionData[1],
          entryDate: positionData[2],
          maturityDate: positionData[3],
          exitDate: positionData[4],
          isActive: positionData[5],
          allPositionsId: positionData[6],
          owner: positionData[7]
        };

        if (position.isActive) {
          // Si la position est active, vérifier si elle est en vente
          const saleInfo = await publicClient.readContract({
            address: contractAddresses.strategyOne,
            abi: contractABIs.strategyOne,
            functionName: 'nftSales',
            args: [BigInt(i)],
          }) as readonly [bigint, boolean];

          console.log(`Position ${i} (NFT #${i + 1}):`, {
            position,
            saleInfo: {
              price: saleInfo[0].toString(),
              isOnSale: saleInfo[1]
            }
          });

          const [salePrice, isOnSale] = saleInfo;

          if (isOnSale && salePrice > BigInt(0)) {
            const NFTid = BigInt(i) + BigInt(1);
            newPositionsForSale.push({
              position,
              NFTid,
              salePrice
            });
          }
        }
      }

      console.log('Final positions for sale:', newPositionsForSale);
      setPositionsForSale(newPositionsForSale);
    } catch (error) {
      console.error('Error fetching positions for sale:', error);
    }
  };

  // Effet pour charger les positions initiales
  useEffect(() => {
    fetchPositionsForSale();
  }, [publicClient]);

  // Effet pour recharger les positions après une transaction confirmée
  useEffect(() => {
    if (isConfirmed) {
      console.log('Transaction confirmée, rechargement des positions...');
      fetchPositionsForSale();
    }
  }, [isConfirmed]);

  const handleBuyNFT = async (NFTid: bigint, salePrice: bigint) => {
    if (!address) return;

    try {
      setIsPending(true);
      const positionId = NFTid - BigInt(1);
      
      console.log('Tentative d\'achat:', {
        NFTid: Number(NFTid),
        positionId: Number(positionId),
        salePrice: salePrice.toString()
      });

      // Récupérer l'adresse gUSDC via le router Pendle
      const gUSDCAddress = await publicClient?.readContract({
        address: contractAddresses.router,
        abi: contractABIs.router,
        functionName: 'gUSDC',
      }) as `0x${string}`;

      console.log('Adresse gUSDC:', gUSDCAddress);
      console.log('Approbation des gUSDC...');

      await writeContract({
        address: gUSDCAddress,
        abi: contractABIs.gUSDC,
        functionName: 'approve',
        args: [contractAddresses.strategyOne, salePrice],
      });

      console.log('Achat du NFT...');
      await writeContract({
        address: contractAddresses.strategyOne,
        abi: contractABIs.strategyOne,
        functionName: 'buyNFT',
        args: [positionId],
      });
    } catch (error) {
      console.error('Erreur lors de l\'achat:', error);
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

  return (
    <div className="space-y-4 max-w-full">
      <h2 className="text-3xl font-bold tracking-tight">Marketplace</h2>
      
      <div className="grid gap-4">
        {positionsForSale.length > 0 ? (
          positionsForSale.map((item) => (
            <div key={Number(item.NFTid)} className="p-4 bg-card rounded-lg border space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2 items-center">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Montant Initial</h4>
                  <p className="text-xl font-bold">{formatAmount(item.position.gUSDCAmount)} gUSDC</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Montant à Maturité</h4>
                  <p className="text-xl font-bold">{formatAmount(item.position.ptAmount)} gUSDC</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Id NFT</h4>
                  <p className="text-xl font-bold">#{Number(item.NFTid)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Prix de vente</h4>
                  <p className="text-xl font-bold text-green-600">{formatAmount(item.salePrice)} gUSDC</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Date d&apos;Entrée</h4>
                  <p className="text-base">{formatDate(item.position.entryDate)}</p>
                  <p className="text-sm text-muted-foreground">Maturité: {formatDate(item.position.maturityDate)}</p>
                  <p className="text-sm text-muted-foreground">
                    {getRemainingTime(item.position.maturityDate)}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {address !== item.position.owner && (
                    <Button
                      onClick={() => handleBuyNFT(item.NFTid, item.salePrice)}
                      disabled={isPending}
                      className="w-full"
                    >
                      {isPending ? "Transaction..." : "Acheter"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 bg-card rounded-lg border text-center">
            <p className="text-muted-foreground">Aucune position en vente</p>
          </div>
        )}
      </div>
    </div>
  );
}