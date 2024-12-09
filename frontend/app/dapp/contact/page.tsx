"use client"

import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

const ContactPage = () => {
    return (
        <div className="container mx-auto p-4 space-y-8">
            <h1 className="text-3xl font-bold tracking-tight mb-8">Contactez-nous</h1>
            
            <div className="grid md:grid-cols-2 gap-6">
                {/* Card CGP */}
                <div className="p-6 bg-card rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                    <h2 className="text-2xl font-semibold mb-4">Vous êtes un CGP ?</h2>
                    <p className="text-muted-foreground mb-6">
                        Contactez l&apos;équipe de SimpliFi pour planifier un échange ! Découvrez comment notre plateforme peut transformer votre gestion de patrimoine.
                    </p>
                    <Button className="w-full">
                        <Mail className="mr-2 h-4 w-4" />
                        Planifier un échange
                    </Button>
                </div>

                {/* Card Client */}
                <div className="p-6 bg-card rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                    <h2 className="text-2xl font-semibold mb-4">Vous êtes un futur client ?</h2>
                    <p className="text-muted-foreground mb-6">
                        Contactez votre chargé de gestion de patrimoine au plus vite pour accéder à nos produits et commencer votre voyage vers une gestion de patrimoine simplifiée !
                    </p>
                    <Button className="w-full">
                        <Mail className="mr-2 h-4 w-4" />
                        Contacter mon CGP
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default ContactPage;