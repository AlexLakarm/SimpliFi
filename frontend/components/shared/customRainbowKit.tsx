'use client'
import React from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import {
  holesky,
  hardhat
} from 'wagmi/chains';
import {
  QueryClientProvider,
  QueryClient,
} from "@tanstack/react-query";

type CustomRainbowKitProviderProps = {
  children: React.ReactNode;
};

const config = getDefaultConfig({
    appName: 'Voting DApp',
    projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'eaf1ccd83974e4ff1615b137976bd7f8',
    chains: [holesky, hardhat],
    ssr: true, 
});

const queryClient = new QueryClient();

const CustomRainbowKitProvider = ({ children }: CustomRainbowKitProviderProps) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider locale="en-US" theme={darkTheme()}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default CustomRainbowKitProvider;