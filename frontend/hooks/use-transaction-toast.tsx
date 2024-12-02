"use client"

import * as React from 'react'
import { useState, useEffect, useRef } from 'react'
import { useToast } from "@/hooks/use-toast"
import { useWaitForTransactionReceipt } from 'wagmi'
import { TransactionToast } from "@/components/ui/transaction-toast"
import { Loader2 } from "lucide-react"

export function useTransactionToast(
    hash: `0x${string}` | undefined,
    error: Error | null = null
) {
    const { toast } = useToast()
    const [hasCopied, setHasCopied] = useState(false)
    const pendingToastRef = useRef<ReturnType<typeof toast>>()

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    })

    const copyToClipboard = async (text: string) => {
        await navigator.clipboard.writeText(text)
        setHasCopied(true)
        setTimeout(() => setHasCopied(false), 2000)
    }

    useEffect(() => {
        if (error && pendingToastRef.current) {
            pendingToastRef.current.dismiss()
            pendingToastRef.current = undefined
            
            toast({
                title: "Transaction Failed",
                description: error.message || "Transaction failed. Please try again.",
                variant: "destructive",
                duration: 5000,
            })
        }
    }, [error, toast])

    useEffect(() => {
        if (hash) {
            toast({
                title: "Transaction Sent",
                description: React.createElement(TransactionToast, {
                    hash,
                    hasCopied,
                    onCopy: copyToClipboard
                }),
                duration: 10000,
            })
        }
    }, [hash, toast, hasCopied])

    useEffect(() => {
        if (isConfirming && !pendingToastRef.current) {
            pendingToastRef.current = toast({
                title: "Transaction Pending",
                description: (
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Waiting for confirmation...</span>
                    </div>
                ),
                variant: "loading",
                duration: Infinity,
            })
        }
    }, [isConfirming, toast])

    useEffect(() => {
        if (isSuccess && hash) {
            if (pendingToastRef.current) {
                pendingToastRef.current.dismiss()
                pendingToastRef.current = undefined
            }
            
            toast({
                title: "Transaction Confirmed",
                description: React.createElement('div', {},
                    React.createElement('p', {}, "Transaction confirmed successfully!"),
                    React.createElement(TransactionToast, {
                        hash,
                        hasCopied,
                        onCopy: copyToClipboard
                    })
                ),
                duration: 10000,
            })
        }
    }, [isSuccess, hash, toast, hasCopied])

    return { isConfirming, isSuccess }
} 