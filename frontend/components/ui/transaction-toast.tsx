import { Copy, Check } from 'lucide-react'
import { Button } from './button'

interface TransactionToastProps {
    hash: `0x${string}`
    hasCopied: boolean
    onCopy: (text: string) => void
}

export function TransactionToast({ hash, hasCopied, onCopy }: TransactionToastProps) {
    return (
        <div className="flex items-center space-x-2">
            <p className="text-sm text-muted-foreground">
                Hash: {hash.slice(0, 6)}...{hash.slice(-4)}
            </p>
            <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => onCopy(hash)}
            >
                {hasCopied ? (
                    <Check className="h-3 w-3" />
                ) : (
                    <Copy className="h-3 w-3" />
                )}
            </Button>
        </div>
    )
} 