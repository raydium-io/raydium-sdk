import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useEffect } from 'react'

import { useAppStore } from '../store/appStore'

export default function useInitSdk() {
  const { publicKey, signAllTransactions } = useWallet()
  const { connection } = useConnection()
  const initRaydium = useAppStore((s) => s.initRaydium)
  const raydium = useAppStore((s) => s.raydium)

  useEffect(() => {
    // raydium sdk initialization can be done with connection only
    if (connection) {
      initRaydium({ owner: publicKey || undefined, connection, signAllTransactions })
    }
  }, [initRaydium, connection])

  useEffect(() => {
    // if user connected wallet, update pubkey
    if (raydium) {
      raydium.setOwner(publicKey || undefined)
      raydium.setSignAllTransactions(signAllTransactions)
      useAppStore.setState({ connected: !!publicKey })
    }
  }, [raydium, publicKey, signAllTransactions])
}
