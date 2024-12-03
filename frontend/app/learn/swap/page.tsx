'use client';

import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Drill } from "lucide-react";
import Link from "next/link";

export default function LearnSwap() {
  return (
    <>
      <div className="container mx-auto p-4 flex justify-start gap-4 mt-16">
        <Link href="/learn">
          <Button
            variant="outline"
            className="flex items-center gap-2 group mb-4 hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
            Page Learn
          </Button>
        </Link>
        {/* Bouton to stratégies */}
        <Link href="/dapp">
          <Button
            variant="outline"
            className="flex items-center gap-2 group mb-4 hover:bg-accent"
          >
            Page Stratégies
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Button>
        </Link>
      </div>
      <div className="container mx-auto p-4">
        <h2 className="text-2xl font-bold">Learn how to swap</h2>
        <div className="flex items-center gap-2 mt-4">
          <Drill className="h-6 w-6 text-muted-foreground" />
          <p className="text-muted-foreground">Coming soon...</p>
        </div>
      </div>
    </>
  );
}