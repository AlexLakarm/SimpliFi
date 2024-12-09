"use client"

import { useState, useEffect } from "react";
import { useAccount, usePublicClient } from 'wagmi';
import { contractAddresses, contractABIs } from "@/app/config/contracts";
import { useRole } from "@/hooks/useRole";
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Position } from '@/app/types';

type NFTSale = {
  salePrice: bigint;
  isOnSale: boolean;
};

type PositionWithNFT = Position & {
  nftId: number;
};

export default function ClientPage() {
  const { address } = useAccount();
  const { role } = useRole();
  const [positions, setPositions] = useState<PositionWithNFT[]>([]);
  const [salesInfo, setSalesInfo] = useState<{ [key: number]: NFTSale }>({});
  const publicClient = usePublicClient();
  const router = useRouter();

  const fetchUserData = async () => {
    if (!address || !publicClient) return;

    try {
      // Récupérer les positions de l'utilisateur
      const positions = await publicClient.readContract({
        address: contractAddresses.strategyOne,
        abi: contractABIs.strategyOne,
        functionName: 'getUserPositions',
        args: [address],
      }) as unknown as Position[];

      console.log('Positions récupérées:', positions);

      // Filtrer les positions actives
      const activePositions = [];
      
      for (const pos of positions) {
        if (!pos.isActive) continue;

        const nftId = Number(pos.allPositionsId) + 1;
        
        // Vérifier le propriétaire actuel du NFT
        const currentOwner = await publicClient.readContract({
          address: contractAddresses.strategyNFT,
          abi: contractABIs.strategyNFT,
          functionName: 'ownerOf',
          args: [BigInt(nftId)],
        }) as `0x${string}`;

        console.log(`NFT #${nftId} - Propriétaire actuel:`, currentOwner);

        // Ne garder que les positions dont l'utilisateur est actuellement propriétaire
        if (currentOwner.toLowerCase() === address.toLowerCase()) {
          activePositions.push({
            ...pos,
            nftId
          });
        }
      }

      console.log('Positions actives avec NFT IDs:', activePositions);
      setPositions(activePositions);

      // Récupérer les infos de vente pour chaque position
      const salesInfoMap: { [key: number]: NFTSale } = {};
      for (const pos of activePositions) {
        const saleInfo = await publicClient.readContract({
          address: contractAddresses.strategyOne,
          abi: contractABIs.strategyOne,
          functionName: 'nftSales',
          args: [pos.allPositionsId],
        }) as [bigint, boolean];

        salesInfoMap[pos.nftId] = {
          salePrice: saleInfo[0],
          isOnSale: saleInfo[1]
        };
      }
      setSalesInfo(salesInfoMap);

    } catch (error) {
      console.error('Erreur lors de la récupération des données:', error);
    }
  };

  // Effet initial pour charger les données
  useEffect(() => {
    fetchUserData();
  }, [address, publicClient]);

  // Écouter les événements de transfert et de vente
  useEffect(() => {
    if (!publicClient || !address) return;

    const unwatchTransfer = publicClient.watchContractEvent({
      address: contractAddresses.strategyNFT,
      abi: contractABIs.strategyNFT,
      eventName: 'Transfer',
      onLogs: (logs) => {
        console.log('Événement Transfer détecté:', logs);
        const isInvolved = logs.some(log => 
          log.args.from === address || log.args.to === address
        );
        if (isInvolved) {
          console.log('Rafraîchissement après transfert...');
          fetchUserData();
        }
      },
    });

    const unwatchSale = publicClient.watchContractEvent({
      address: contractAddresses.strategyOne,
      abi: contractABIs.strategyOne,
      eventName: 'NFTSold',
      onLogs: (logs) => {
        console.log('Événement NFTSold détecté:', logs);
        const isInvolved = logs.some(log => 
          log.args.seller === address || log.args.buyer === address
        );
        if (isInvolved) {
          console.log('Rafraîchissement après vente...');
          fetchUserData();
        }
      },
    });

    return () => {
      unwatchTransfer();
      unwatchSale();
    };
  }, [address, publicClient]);

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
      {role !== 'CLIENT' && (
        <div className="fixed top-20 left-4 w-full max-w-sm">
          <div className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md">
            Accès restreint aux clients
          </div>
        </div>
      )}
      
      <h2 className="text-3xl font-bold tracking-tight">Mes Positions</h2>
      
      <div className="grid gap-4">
        {positions.length > 0 ? (
          positions.map((position) => (
            <div key={position.nftId} className="p-4 bg-card rounded-lg border space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 items-center">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Montant Initial</h4>
                  <p className="text-xl font-bold">{formatAmount(position.gUSDCAmount)} gUSDC</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Montant à Maturité</h4>
                  <p className="text-xl font-bold">{formatAmount(position.ptAmount)} gUSDC</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Id NFT</h4>
                  <p className="text-xl font-bold">#{position.nftId}</p>
                  {salesInfo[position.nftId] && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {salesInfo[position.nftId].isOnSale ? (
                          <span className="text-green-600">En vente</span>
                        ) : (
                          "Pas en vente"
                        )}
                      </p>
                      {salesInfo[position.nftId].isOnSale && (
                        <p className="text-sm text-muted-foreground">
                          Prix: {formatAmount(salesInfo[position.nftId].salePrice)} gUSDC
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Date d&apos;Entrée</h4>
                  <p className="text-base">{formatDate(position.entryDate)}</p>
                  <p className="text-sm text-muted-foreground">Maturité: {formatDate(position.maturityDate)}</p>
                  <p className="text-sm text-muted-foreground">
                    {getRemainingTime(position.maturityDate)}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => router.push(`/dapp/mapage/${position.nftId}`)}
                    className="w-full"
                  >
                    Gérer ma position
                  </Button>
                </div>
              </div>
            </div>
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