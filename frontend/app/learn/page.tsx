'use client';

import { Button } from "@/components/ui/button";
import { ArrowLeft, Drill } from "lucide-react";
import Link from "next/link";

export default function Learn() {
  return (
    <div className="container mx-auto p-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center">
          <Link href="/">
            <Button 
              variant="outline" 
              size="sm"
              className="flex items-center gap-2 group hover:bg-accent mt-14"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Retour
            </Button>
          </Link>
        </div>
        <div className="container mx-auto p-4">
        <h2 className="text-2xl font-bold">Learn</h2>
        <div className="flex items-center gap-2 mt-4">
          <Drill className="h-6 w-6 text-muted-foreground" />
          <p className="text-muted-foreground">Coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
}