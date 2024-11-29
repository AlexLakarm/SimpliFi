'use client';

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function Learn() {
  return (
    <div className="container mx-auto p-4">
      <div className="max-w-5xl mx-auto">
        {/* Bouton retour */}
        <Link href="/">
          <Button 
            variant="ghost" 
            className="flex items-center gap-2 group mb-8 hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
            Retour
          </Button>
        </Link>

        {/* Contenu existant */}
        <div>Learn : coming soon</div>
      </div>
    </div>
  );
}