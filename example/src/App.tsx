import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { ConnectionProvider, useConnection, useWallet, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import {
  GlowWalletAdapter,
  PhantomWalletAdapter,
  SlopeWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { FC, ReactNode, useEffect, useMemo } from 'react'

import { useAppStore } from './store/appStore'

require('./App.css')
require('@solana/wallet-adapter-react-ui/styles.css')

const App: FC = () => {
  return (
    <Context>
      <Content />
    </Context>
  )
}
export default App

const Context: FC<{ children: ReactNode }> = ({ children }) => {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
  const network = WalletAdapterNetwork.Mainnet

  // You can also provide a custom RPC endpoint.
  const endpoint = 'https://solana-api.projectserum.com' // mainnet has rate limit so use Project Serum-hosted api node

  // You can also provide a custom RPC endpoint.
  //   const endpoint = useMemo(() => clusterApiUrl(network), [network])

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new GlowWalletAdapter(),
      new SlopeWalletAdapter(),
      new SolflareWalletAdapter({ network }),
      new TorusWalletAdapter(),
    ],
    [network]
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

const Content: FC = () => {
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  const initRaydium = useAppStore((s) => s.initRaydium)
  const raydium = useAppStore((s) => s.raydium)

  useEffect(() => {
    if (publicKey) {
      console.log(123123111, raydium)
      initRaydium({ owner: publicKey, connection })
    }
  }, [publicKey, connection])

  useEffect(() => {
    console.log(123123222, raydium)
  }, [raydium])
  return (
    <div className="App">
      <WalletMultiButton />
    </div>
  )
}
