import { useAccount, useReadContract } from 'wagmi';
import { contractAddresses, contractABIs } from "@/app/config/contracts";

export type RoleState = {
  role: string | undefined;
  isPending: boolean;
  error: Error | null;
  isConnected: boolean;
  address: `0x${string}` | undefined;
  hasRole: boolean;
};

export function useRole(): RoleState {
  const { address, isConnected } = useAccount();

  const { data: role, isPending, error } = useReadContract({
    address: contractAddresses.roleControl,
    abi: contractABIs.roleControl,
    functionName: 'getRoles',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address,
    }
  });

  return {
    role,
    isPending,
    error,
    isConnected,
    address,
    hasRole: role !== "NO_ROLE"
  };
} 