"use client"

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo } from "react";
import { useWriteContract, useReadContract } from 'wagmi';
import { contractAddresses, contractABIs } from "@/app/config/contracts";
import { isAddress } from 'viem';
import { groupBy } from 'lodash';
import { useRole } from "@/hooks/useRole";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

// Type pour les clients retournés par le contrat
type ClientInfo = {
  clientAddress: string;
  cgpAddress: string;
  isActive: boolean;
};

export function AdminPage() {
  const router = useRouter();
  const { role } = useRole();
  const [isClient, setIsClient] = useState(false);
  const [newCGPAddress, setNewCGPAddress] = useState('');
  const [cgpToDelete, setCgpToDelete] = useState('');
  const [cgpList, setCGPList] = useState<string[]>([]);
  const [clientList, setClientList] = useState<ClientInfo[]>([]);
  const [cgpSearch, setCgpSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Lecture de la liste des CGP
  const { data: registeredCGPs } = useReadContract({
    address: contractAddresses.roleControl,
    abi: contractABIs.roleControl,
    functionName: 'getAllCGPs',
  });

  // Mise à jour de la liste des CGP
  useEffect(() => {
    if (registeredCGPs) {
      setCGPList(registeredCGPs as string[]);
    }
  }, [registeredCGPs]);

  // Lecture de la liste des clients
  const { data: registeredClients } = useReadContract({
    address: contractAddresses.roleControl,
    abi: contractABIs.roleControl,
    functionName: 'getAllClients',
  });

  // Mise à jour de la liste des clients
  useEffect(() => {
    if (registeredClients) {
      setClientList(registeredClients as ClientInfo[]);
    }
  }, [registeredClients]);

  // Écriture du contrat pour ajouter/supprimer un CGP
  const { writeContract, isPending } = useWriteContract();

  // Fonction pour vérifier si une adresse est valide
  const isValidAddress = (address: string): boolean => {
    try {
      return isAddress(address) !== false;
    } catch {
      return false;
    }
  };

  // Fonction pour ajouter un CGP
  const handleAddCGP = async () => {
    if (!newCGPAddress || !isValidAddress(newCGPAddress)) return;

    writeContract({
      address: contractAddresses.roleControl,
      abi: contractABIs.roleControl,
      functionName: 'addCGP',
      args: [newCGPAddress as `0x${string}`],
    });
  };

  // Fonction pour supprimer un CGP
  const handleDeleteCGP = async () => {
    if (!cgpToDelete || !isValidAddress(cgpToDelete)) return;

    writeContract({
      address: contractAddresses.roleControl,
      abi: contractABIs.roleControl,
      functionName: 'deleteCGP',
      args: [cgpToDelete as `0x${string}`],
    });
  };

  // Filtrer les CGPs
  const filteredCGPs = useMemo(() => {
    if (!cgpSearch) return cgpList;
    return cgpList.filter(address => 
      address.toLowerCase().includes(cgpSearch.toLowerCase())
    );
  }, [cgpList, cgpSearch]);

  // Filtrer les clients par CGP et par adresse client
  const filteredClientsByCGP = useMemo(() => {
    let filtered = clientList;

    // Filtrer par adresse client si une recherche est active
    if (clientSearch) {
      filtered = filtered.filter(client =>
        client.clientAddress.toLowerCase().includes(clientSearch.toLowerCase())
      );
    }

    // Grouper par CGP
    const grouped = groupBy(filtered, 'cgpAddress');
    
    // Filtrer les CGPs si une recherche CGP est active
    let entries = Object.entries(grouped);
    if (cgpSearch) {
      entries = entries.filter(([cgpAddress]) =>
        cgpAddress.toLowerCase().includes(cgpSearch.toLowerCase())
      );
    }

    return entries.sort(([cgpA], [cgpB]) => cgpA.localeCompare(cgpB));
  }, [clientList, cgpSearch, clientSearch]);

  return (
    <div className="space-y-6 max-w-full">
      {isClient && role !== 'ADMIN' && (
        <div className="fixed top-20 left-4 w-full max-w-sm">
          <div className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md">
            Accès restreint aux administrateurs
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold tracking-tight">Administration du protocole SimpliFi</h2>
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
      
      {/* Section Actions CGP */}
      <div className="grid gap-6 w-full">
        {/* Conteneur des actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bloc Ajout CGP */}
          <div className="p-4 md:p-6 bg-card rounded-lg border w-full">
            <h3 className="text-xl font-semibold mb-4">Ajouter un CGP</h3>
            <div className="flex flex-col gap-4">
              <Input
                placeholder="Adresse du CGP"
                value={newCGPAddress}
                onChange={(e) => setNewCGPAddress(e.target.value)}
                className="w-full min-w-0"
              />
              <Button 
                onClick={handleAddCGP}
                disabled={isPending || !newCGPAddress || !isValidAddress(newCGPAddress)}
                className="w-full"
              >
                {isPending ? "Transaction en cours..." : "Ajouter"}
              </Button>
            </div>
          </div>

          {/* Bloc Suppression CGP */}
          <div className="p-4 md:p-6 bg-card rounded-lg border w-full">
            <h3 className="text-xl font-semibold mb-4 text-destructive">Supprimer un CGP</h3>
            <div className="flex flex-col gap-4">
              <Input
                placeholder="Adresse du CGP à supprimer"
                value={cgpToDelete}
                onChange={(e) => setCgpToDelete(e.target.value)}
                className="w-full min-w-0"
              />
              <Button 
                onClick={handleDeleteCGP}
                disabled={isPending || !cgpToDelete || !isValidAddress(cgpToDelete)}
                variant="destructive"
                className="w-full"
              >
                {isPending ? "Transaction en cours..." : "Supprimer"}
              </Button>
              <p className="text-sm text-muted-foreground">
                Note: Un CGP ne peut être supprimé que s&apos;il n&apos;a plus de clients actifs.
              </p>
            </div>
          </div>
        </div>

        {/* Liste des CGP avec recherche */}
        <div className="space-y-4 w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <Input
              placeholder="Rechercher un CGP par adresse..."
              value={cgpSearch}
              onChange={(e) => setCgpSearch(e.target.value)}
              className="w-full sm:max-w-md min-w-0"
            />
            {cgpSearch && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setCgpSearch('')}
                className="ml-auto"
              >
                Effacer
              </Button>
            )}
          </div>
          <div className="p-4 md:p-6 bg-card rounded-lg border overflow-hidden">
            <h3 className="text-xl font-semibold mb-4">
              CGP enregistrés
              {cgpSearch && (
                <span className="ml-2 text-sm text-muted-foreground">
                  ({filteredCGPs.length} résultat{filteredCGPs.length > 1 ? 's' : ''})
                </span>
              )}
            </h3>
            <div className="space-y-2">
              {filteredCGPs.length > 0 ? (
                filteredCGPs.map((address, index) => (
                  <div 
                    key={index}
                    className="p-3 bg-muted rounded-md font-mono text-sm flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="break-all">{address}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive shrink-0"
                      onClick={() => setCgpToDelete(address)}
                    >
                      Supprimer
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">
                  {cgpSearch ? "Aucun CGP trouvé" : "Aucun CGP enregistré"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Liste des Clients par CGP avec recherche */}
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
              Clients par CGP
              {clientSearch && (
                <span className="ml-2 text-sm text-muted-foreground">
                  ({filteredClientsByCGP.reduce((acc, [, clients]) => acc + clients.length, 0)} résultat
                  {filteredClientsByCGP.reduce((acc, [, clients]) => acc + clients.length, 0) > 1 ? 's' : ''})
                </span>
              )}
            </h3>
            <div className="space-y-6">
              {filteredClientsByCGP.length > 0 ? (
                filteredClientsByCGP.map(([cgpAddress, clients]) => (
                  <div key={cgpAddress} className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-primary break-all">CGP: {cgpAddress}</h4>
                      <span className="text-sm text-muted-foreground shrink-0">
                        ({clients.length} client{clients.length > 1 ? 's' : ''})
                      </span>
                    </div>
                    <div className="space-y-2 pl-4">
                      {clients.map((client, index) => (
                        <div 
                          key={index}
                          className={`p-3 bg-muted rounded-md font-mono text-sm flex flex-wrap items-center gap-2 ${
                            !client.isActive ? 'opacity-50' : ''
                          }`}
                        >
                          <span className="break-all">{client.clientAddress}</span>
                          {!client.isActive && (
                            <span className="text-xs px-2 py-0.5 bg-destructive/10 text-destructive rounded shrink-0">
                              Inactif
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
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

        {/* Bouton Mock Pendle Management */}
        <div className="flex justify-end">
          <Button 
            variant="outline"
            className="border-2 border-destructive"
            onClick={() => router.push('/dapp/mapage/pendle')}
          >
            Mock Pendle Management
          </Button>
        </div>
      </div>
    </div>
  );
} 