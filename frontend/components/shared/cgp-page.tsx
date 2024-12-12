"use client"

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useWriteContract, useReadContract, useAccount } from 'wagmi';
import { contractAddresses, contractABIs } from "@/app/config/contracts";
import { isAddress } from 'viem';
import { useRole } from "@/hooks/useRole";
import { useTransactionToast } from "@/hooks/use-transaction-toast";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

export function CGPPage() {
  const { address } = useAccount();
  const { role } = useRole();
  const [isClient, setIsClient] = useState(false);
  const [newClientAddress, setNewClientAddress] = useState('');
  const [clientToDelete, setClientToDelete] = useState('');
  const [clientAddresses, setClientAddresses] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState('');

  useEffect(() => {
    setIsClient(true);
  }, []);

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

  // Écriture du contrat pour ajouter/supprimer un client
  const { writeContract, data: hash, error, isPending } = useWriteContract();

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

  return (
    <div className="container mx-auto p-4">
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

      {isClient && role !== 'CGP' && (
        <div className="fixed top-20 left-4 w-full max-w-sm">
          <div className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md">
            Accès restreint aux CGP
          </div>
        </div>
      )}

      <div className="space-y-6 max-w-full">
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

          {/* Liste des Clients avec recherche */}
          <div className="space-y-4 w-full">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <Input
                placeholder="Rechercher un client par adresse..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full sm:max-w-md min-w-0"
              />
              {clientSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setClientSearch('')}
                  className="ml-auto"
                >
                  Effacer
                </Button>
              )}
            </div>
            <div className="p-4 md:p-6 bg-card rounded-lg border overflow-hidden">
              <h3 className="text-xl font-semibold mb-4">
                Mes Clients
                {clientSearch && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({filteredClients.length} résultat{filteredClients.length > 1 ? 's' : ''})
                  </span>
                )}
              </h3>
              <div className="space-y-2">
                {filteredClients.length > 0 ? (
                  filteredClients.map((address, index) => (
                    <div
                      key={index}
                      className="p-3 bg-muted rounded-md font-mono text-sm flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="break-all">{address}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive shrink-0"
                        onClick={() => setClientToDelete(address)}
                      >
                        Supprimer
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">
                    {clientSearch ? "Aucun client trouvé" : "Aucun client enregistré"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 