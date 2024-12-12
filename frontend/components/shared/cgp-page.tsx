"use client"

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useWriteContract, useReadContract, useAccount, usePublicClient } from 'wagmi';
import { contractAddresses, contractABIs } from "@/app/config/contracts";
import { isAddress } from 'viem';
import { useRole } from "@/hooks/useRole";
import { useTransactionToast } from "@/hooks/use-transaction-toast";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

// Type pour une position
type Position = {
  gUSDCAmount: bigint;
  ptAmount: bigint;
  entryDate: bigint;
  maturityDate: bigint;
  exitDate: bigint;
  isActive: boolean;
  allPositionsId: bigint;
  owner: `0x${string}`;
};

export function CGPPage() {
  const { address } = useAccount();
  const { role } = useRole();
  const publicClient = usePublicClient();
  const { writeContract, data: hash, error, isPending } = useWriteContract();

  const [clientAddresses, setClientAddresses] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [clientToDelete, setClientToDelete] = useState('');
  const [clientPositions, setClientPositions] = useState<Position[]>([]);

  // Toast pour les transactions
  useTransactionToast(hash, error);

  // Lecture de la liste des clients du CGP
  const { data: cgpClients, refetch: refetchClients } = useReadContract({
    address: contractAddresses.roleControl,
    abi: contractABIs.roleControl,
    functionName: 'getCGPClients',
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address)
    }
  });

  // Mise à jour de la liste des clients
  useEffect(() => {
    if (cgpClients) {
      setClientAddresses(cgpClients as `0x${string}`[]);
    }
  }, [cgpClients]);



  // Utilisation du hook de toast pour suivre la transaction
  const { isSuccess } = useTransactionToast(hash, error);

  // Rafraîchir la liste après une transaction réussie
  useEffect(() => {
    if (isSuccess) {
      refetchClients();
    }
  }, [isSuccess, refetchClients]);

  // Fonction pour ajouter un client
  const handleAddClient = async () => {
    if (!newClientAddress || !isAddress(newClientAddress)) return;

    writeContract({
      address: contractAddresses.roleControl,
      abi: contractABIs.roleControl,
      functionName: 'addClient',
      args: [newClientAddress as `0x${string}`],
    });
  };

  // Fonction pour supprimer un client
  const handleDeleteClient = async () => {
    if (!clientToDelete || !isAddress(clientToDelete)) return;

    writeContract({
      address: contractAddresses.roleControl,
      abi: contractABIs.roleControl,
      functionName: 'deleteClient',
      args: [clientToDelete as `0x${string}`],
    });
  };

  // Filtrer les clients
  const filteredClients = clientAddresses.filter(address =>
    !clientSearch || address.toLowerCase().includes(clientSearch.toLowerCase())
  );

  // Lecture des positions du client recherché
  useEffect(() => {
    const fetchClientPositions = async () => {
      if (!clientSearch || !isAddress(clientSearch) || !publicClient) return;

      try {
        const positions = await publicClient.readContract({
          address: contractAddresses.strategyOne,
          abi: contractABIs.strategyOne,
          functionName: 'getUserPositions',
          args: [clientSearch]
        }) as Position[];

        setClientPositions(positions);
      } catch (error) {
        console.error('Erreur lors de la récupération des positions:', error);
        setClientPositions([]);
      }
    };

    fetchClientPositions();
  }, [clientSearch, publicClient]);

  // Fonction pour formater la date
  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6 max-w-full">
      {!role && (
        <div className="fixed top-20 left-4 w-full max-w-sm">
          <div className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md">
            Accès restreint aux CGP
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold tracking-tight">Tableau de bord CGP</h2>
        <Link href="/dapp/mapage/fees">
          <Button
            variant="outline"
            size="lg"
            className="flex items-center gap-2 group hover:bg-green-800 border-green-800"
          >
            Gestion des frais
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </Link>
      </div>

      {/* Section Actions Clients */}
      <div className="grid gap-6 w-full">
        {/* Conteneur des actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bloc Ajout Client */}
          <div className="p-4 md:p-6 bg-card rounded-lg border w-full">
            <h3 className="text-xl font-semibold mb-4">Ajouter un Client</h3>
            <div className="flex flex-col gap-4">
              <Input
                placeholder="Adresse du client"
                value={newClientAddress}
                onChange={(e) => setNewClientAddress(e.target.value)}
                className="w-full min-w-0"
              />
              <Button
                onClick={handleAddClient}
                disabled={isPending || !newClientAddress || !isAddress(newClientAddress)}
                className="w-full"
              >
                {isPending ? "Transaction en cours..." : "Ajouter"}
              </Button>
            </div>
          </div>

          {/* Bloc Suppression Client */}
          <div className="p-4 md:p-6 bg-card rounded-lg border w-full">
            <h3 className="text-xl font-semibold mb-4 text-destructive">Supprimer un Client</h3>
            <div className="flex flex-col gap-4">
              <Input
                placeholder="Adresse du client à supprimer"
                value={clientToDelete}
                onChange={(e) => setClientToDelete(e.target.value)}
                className="w-full min-w-0"
              />
              <Button
                onClick={handleDeleteClient}
                disabled={isPending || !clientToDelete || !isAddress(clientToDelete)}
                variant="destructive"
                className="w-full"
              >
                {isPending ? "Transaction en cours..." : "Supprimer"}
              </Button>
            </div>
          </div>
        </div>

        {/* Liste des Clients et Positions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Liste des Clients avec recherche */}
          <Card>
            <CardHeader>
              <CardTitle>Mes clients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input
                  placeholder="Rechercher un client par adresse"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full border-blue-500"
                />
                <div className="space-y-2">
                  {filteredClients.map((address) => (
                    <div
                      key={address}
                      className="p-4 border rounded flex items-center justify-between"
                    >
                      <span className="font-mono text-sm">{address}</span>
                    </div>
                  ))}
                  {filteredClients.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      Aucun client trouvé
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Carte des positions du client */}
          <Card>
            <CardHeader>
              <CardTitle>Les positions de mes clients</CardTitle>
              <CardDescription>
                {!clientSearch 
                  ? "Rechercher l'adresse d'un client pour afficher ses positions"
                  : `Positions du client ${clientSearch}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clientSearch ? (
                <div className="space-y-4">
                  {clientPositions.map((position, index) => (
                    <div key={index} className="p-4 border rounded">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Montant Initial</p>
                          <p className="text-lg font-semibold">{Number(position.gUSDCAmount) / 1e6} gUSDC</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Montant à Maturité</p>
                          <p className="text-lg font-semibold">{Number(position.ptAmount) / 1e6} gUSDC</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div>
                          <p className="text-sm text-muted-foreground">État</p>
                          <p className="text-lg font-semibold">
                            {position.isActive ? "Active" : "Inactive"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Date de Maturité</p>
                          <p className="text-lg font-semibold">
                            {formatDate(position.maturityDate)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {clientPositions.length === 0 && (
                    <p className="text-center text-muted-foreground">
                      Aucune position trouvée pour ce client
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <p>Utilisez la barre de recherche ci-contre pour afficher les positions d&apos;un client</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 