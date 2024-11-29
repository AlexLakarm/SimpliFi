'use client';

import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Rocket } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { Geist, Inter, Orbitron } from "next/font/google";
import backgroundImage from './../public/assets/fonddegrad.jpg';

const inter = Inter({ 
  subsets: ["latin"],
  weight: ['700']
});

const orbitron = Orbitron({
  weight: ['700'],
  subsets: ['latin']
});

const geist = Geist({
  subsets: ['latin'],
  weight: ['200']
});

export default function Home() {
  const { address, isConnected } = useAccount();

  return (
    <main className="container mx-auto p-4">
      {/* Titre et slogan */}
      <div className="text-center mb-8">
        <p className={`
          ${geist.className} 
          text-2xl md:text-3xl 
          text-foreground/90
          max-w-4xl
          mt-8
          mx-auto
          leading-relaxed
          px-4
        `}>
          Bienvenue sur SimpliFi, accédez aux opportunités offertes par la finance 3.0.
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mt-12 max-w-6xl mx-auto">
        {/* Card Novice */}
        <Card className="relative overflow-hidden min-h-[400px]">
          <div className="absolute inset-0 w-full h-full">
            <Image
              src={backgroundImage}
              alt="Fond dégradé"
              fill
              priority
              className="object-cover object-center"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-background/20" />
          </div>
          <div className="flex flex-col h-full">
            <CardHeader className="relative z-10">
              <CardTitle className={`${inter.className} text-2xl tracking-wide text-center`}>
                Vous êtes néophyte  
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 flex-1 flex flex-col items-center justify-center">
              <div className="text-center">
                <p className="text-lg mb-8 max-w-sm">
                  Découvrez avec nous le monde de la blockchain, de l'installation de votre premier portefeuille numérique aux arcanes de la finance décentralisée.
                </p>
                <div className="flex justify-center">
                  <Link href="/learn">
                    <Button 
                      className="flex items-center gap-2 group text-lg py-6 px-8"
                      variant="outline"
                    >
                      Nous vous expliquons
                      <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>

        {/* Card Vault */}
        <Card className="relative overflow-hidden min-h-[400px]">
          <div className="absolute inset-0 w-full h-full">
            <Image
              src={backgroundImage}
              alt="Fond dégradé"
              fill
              priority
              className="object-cover object-center"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-background/20" />
          </div>
          <div className="flex flex-col h-full">
            <CardHeader className="relative z-10">
              <CardTitle className={`${inter.className} text-2xl tracking-wide text-center`}>
                Vous avez déjà un wallet Web3
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 flex-1 flex flex-col items-center justify-center">
              {isConnected ? (
                <div className="text-center">
                  <p className="text-lg mb-8 max-w-sm">
                    Connecté avec : {address?.slice(0, 6)}...{address?.slice(-4)}
                  </p>
                  <Link href="/dapp" className="block">
                    <Button 
                      className="flex items-center gap-2 group text-lg py-6 px-8"
                      variant="outline"
                    >
                      Accéder à SimpliFi
                      <Rocket className="h-5 w-5 transition-transform duration-300 group-hover:scale-125" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-lg mb-8 max-w-sm">
                    Veuillez connecter votre portefeuille en haut à droite de votre écran pour accéder à l'application décentralisée.
                  </p>
                </div>
              )}
            </CardContent>
          </div>
        </Card>
      </div>
    </main>
  );
}