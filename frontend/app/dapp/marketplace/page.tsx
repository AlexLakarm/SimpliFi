"use client"

import { useEffect, useState, useCallback } from "react";
import { useAccount, usePublicClient, useWriteContract, useTransactionConfirmations } from 'wagmi';
import { contractAddresses, contractABIs } from '@/app/config/contracts';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { useTransactionToast } from "@/hooks/use-transaction-toast";
import { Position } from "@/app/types";

type PositionForSale = {
  position: Position;
  NFTid: bigint;
  salePrice: bigint;
};

export default function Marketplace() {
  const { address } = useAccount();
  const [positionsForSale, setPositionsForSale] = useState<PositionForSale[]>([]);
  const [approvals, setApprovals] = useState<{ [key: string]: boolean }>({});
  const [gUSDCAddress, setGUSDCAddress] = useState<`0x${string}`>();
  const publicClient = usePublicClient();

  // Gestion des transactions
  const { writeContract, data: hash, error, isPending } = useWriteContract();

  // Attendre les confirmations
  const { data: confirmations, isLoading: isWaitingConfirmation } = useTransactionConfirmations({
    hash,
  });

  // Utilisation du hook de toast pour suivre la transaction
  useTransactionToast(hash, error);

  // Vérifier l'approbation
  const checkApproval = useCallback(async (positionId: bigint, salePrice: bigint) => {
    if (!address || !gUSDCAddress || !publicClient) return;

    try {
      const allowance = await publicClient.readContract({
        address: gUSDCAddress,
        abi: contractABIs.gUSDC,
        functionName: 'allowance',
        args: [address, contractAddresses.strategyOne]
      }) as bigint;
      
      setApprovals(prev => ({
        ...prev,
        [positionId.toString()]: allowance >= salePrice
      }));
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'approbation:', error);
    }
  }, [address, gUSDCAddress, publicClient]);

  // Charger les positions
  const loadPositions = useCallback(async () => {
    if (!publicClient) return;
    
    try {
      const totalPositions = await publicClient.readContract({
        address: contractAddresses.strategyOne,
        abi: contractABIs.strategyOne,
        functionName: 'getAllActivePositionsCount',
      }) as bigint;

      const newPositionsForSale = [];
      for (let i = 0; i < Number(totalPositions); i++) {
        const position = await publicClient.readContract({
          address: contractAddresses.strategyOne,
          abi: contractABIs.strategyOne,
          functionName: 'allPositions',
          args: [BigInt(i)]
        }) as readonly [bigint, bigint, bigint, bigint, bigint, boolean, bigint, `0x${string}`];

        const positionData: Position = {
          gUSDCAmount: position[0],
          ptAmount: position[1],
          entryDate: position[2],
          maturityDate: position[3],
          exitDate: position[4],
          isActive: position[5],
          allPositionsId: position[6],
          owner: position[7]
        };

        const sale = await publicClient.readContract({
          address: contractAddresses.strategyOne,
          abi: contractABIs.strategyOne,
          functionName: 'nftSales',
          args: [BigInt(i)]
        }) as [bigint, boolean];
        
        if (sale[1] && position[5]) {
          const NFTid = BigInt(i) + BigInt(1);
          newPositionsForSale.push({
            position: positionData,
            NFTid,
            salePrice: sale[0]
          });
        }
      }
      setPositionsForSale(newPositionsForSale);
    } catch (error) {
      console.error('Erreur lors du chargement des positions:', error);
    }
  }, [publicClient]);

  // Effet pour rafraîchir les données après une transaction confirmée
  useEffect(() => {
    if (confirmations === BigInt(1)) {
      loadPositions();
      // Vérifier toutes les approbations après une transaction confirmée
      positionsForSale.forEach(item => {
        checkApproval(item.position.allPositionsId, item.salePrice);
      });
    }
  }, [confirmations, loadPositions, checkApproval, positionsForSale]);

  // Effet pour charger les positions initiales
  useEffect(() => {
    const init = async () => {
      await loadPositions();
      // Vérifier les approbations pour toutes les positions chargées
      positionsForSale.forEach(item => {
        checkApproval(item.position.allPositionsId, item.salePrice);
      });
    };
    init();
  }, [loadPositions, checkApproval, positionsForSale]);

  // Récupérer l'adresse gUSDC
  useEffect(() => {
    const fetchGUSDCAddress = async () => {
      if (!publicClient) return;
      try {
        const address = await publicClient.readContract({
          address: contractAddresses.router,
          abi: contractABIs.router,
          functionName: 'gUSDC',
        }) as `0x${string}`;
        setGUSDCAddress(address);
      } catch (error) {
        console.error('Erreur lors de la récupération de l\'adresse gUSDC:', error);
      }
    };
    fetchGUSDCAddress();
  }, [publicClient]);

  // Gérer l'approbation
  const handleApprove = async (salePrice: bigint) => {
    if (!gUSDCAddress) return;
    
    try {
      writeContract({
        address: gUSDCAddress,
        abi: contractABIs.gUSDC,
        functionName: 'approve',
        args: [contractAddresses.strategyOne, salePrice],
      });
    } catch (error) {
      console.error('Erreur lors de l\'approbation:', error);
    }
  };

  // Gérer l'achat
  const handleBuyNFT = async (positionId: bigint) => {
    try {
      writeContract({
        address: contractAddresses.strategyOne,
        abi: contractABIs.strategyOne,
        functionName: 'buyNFT',
        args: [positionId],
      });
    } catch (error) {
      console.error('Erreur lors de l\'achat:', error);
    }
  };

  // Gérer le clic sur le bouton
  const handleButtonClick = (NFTid: bigint, salePrice: bigint) => {
    const positionId = NFTid - BigInt(1);
    const isApproved = approvals[positionId.toString()];

    if (!isApproved) {
      handleApprove(salePrice);
    } else {
      handleBuyNFT(positionId);
    }
  };

  // Fonctions de formatage
  const formatAmount = (amount: bigint) => {
    return (Number(amount) / 1e6).toFixed(2);
  };

  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return format(date, 'dd/MM/yyyy HH:mm');
  };

  const getRemainingTime = (maturityDate: bigint) => {
    const date = new Date(Number(maturityDate) * 1000);
    return formatDistanceToNow(date, { addSuffix: true, locale: fr });
  };

  const isTransactionInProgress = isPending || isWaitingConfirmation;

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
                      onClick={() => handleButtonClick(item.NFTid, item.salePrice)}
                      disabled={isTransactionInProgress}
                      className="w-full"
                    >
                      {isTransactionInProgress ? "Transaction en cours..." : (
                        approvals[item.position.allPositionsId.toString()]
                          ? "Acheter"
                          : "Autoriser la dépense"
                      )}
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