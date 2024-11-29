"use client"
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Orbitron } from "next/font/google";

const orbitron = Orbitron({
    weight: ['700'],
    subsets: ['latin']
});

const Header = () => {

    const pathname = usePathname();
    const showBackButton = pathname.startsWith('/vault');

    return (
        <header className="border-b">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {showBackButton ? (
                        <Link href="/">
                            <Button variant="outline" className="flex items-center gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                Back to Home
                            </Button>
                        </Link>
                    ) : (
                        <Link href="/">
                            <h1 className={`
                                ${orbitron.className} 
                                text-3xl
                                bg-clip-text text-transparent 
                                bg-gradient-to-r from-primary via-primary/90 to-primary 
                                font-bold
                                hover:opacity-80 transition-opacity
                                tracking-wider
                            `}>
                                SimpliFi
                            </h1>
                        </Link>
                    )}
                </div>
                <div className="flex items-center gap-4 ml-auto">
                    <ModeToggle />
                    <ConnectButton.Custom>
                        {({
                            account,
                            chain,
                            openAccountModal,
                            openChainModal,
                            openConnectModal,
                            mounted,
                        }) => {
                            const ready = mounted;
                            const connected = ready && account && chain;

                            return (
                                <div
                                    {...(!ready && {
                                        'aria-hidden': true,
                                        style: {
                                            opacity: 0,
                                            pointerEvents: 'none',
                                            userSelect: 'none',
                                        },
                                    })}
                                >
                                    {(() => {
                                        if (!connected) {
                                            return (
                                                <button
                                                    onClick={openConnectModal}
                                                    className="relative px-6 py-2 bg-white dark:bg-gray-800 rounded-lg
                                                    group overflow-hidden transition-all duration-300
                                                    hover:scale-105"
                                                >
                                                    <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-yellow-500 to-red-500 opacity-75 group-hover:opacity-100 transition-opacity duration-300"></span>
                                                    <span className="absolute inset-[1px] bg-white dark:bg-gray-800 rounded-lg"></span>
                                                    <span className="relative z-10 font-medium text-black dark:text-white transition-colors duration-300">
                                                        Connect Wallet
                                                    </span>
                                                </button>
                                            );
                                        }

                                        return (
                                            <div className="flex gap-3">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={openChainModal}
                                                >
                                                    {chain.name}
                                                </Button>

                                                <button
                                                    onClick={openAccountModal}
                                                    className="relative px-4 py-2 bg-white dark:bg-gray-800 rounded-lg
                                                    group overflow-hidden transition-all duration-300
                                                    hover:scale-105"
                                                >
                                                    <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-yellow-500 to-red-500 opacity-75 group-hover:opacity-100 transition-opacity duration-300"></span>
                                                    <span className="absolute inset-[1px] bg-white dark:bg-gray-800 rounded-lg"></span>
                                                    <span className="relative z-10 font-medium text-black dark:text-white transition-colors duration-300">
                                                        {account.displayName}
                                                    </span>
                                                </button>
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        }}
                    </ConnectButton.Custom>
                </div>
            </div>
        </header>
    );
};

export default Header;