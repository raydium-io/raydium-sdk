import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Toolbar from '@mui/material/Toolbar'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import {
  GlowWalletAdapter,
  PhantomWalletAdapter,
  SlopeWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { FC, ReactNode, useMemo } from 'react'
import { BrowserRouter, Link } from 'react-router-dom'

import AppRoute, { ROUTE_PATH } from './AppRoute'
import useInitSdk from './hook/useInitSdk'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
dayjs.extend(utc)

require('@solana/wallet-adapter-react-ui/styles.css')

const App: FC = () => {
  return (
    <BrowserRouter>
      <Context>
        <Content />
      </Context>
    </BrowserRouter>
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
  useInitSdk()
  return (
    <div>
      <ButtonAppBar />
      <AppRoute />
    </div>
  )
}

const LinkStyle = { textDecoration: 'none', color: '#FFF', marginRight: '10px' }
function ButtonAppBar() {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" sx={{ bg: 'gray' }}>
        <Toolbar>
          <Grid container alignItems="center" sx={{ flexGrow: 1, maxWidth: 'calc(100% - 160px)' }}>
            <Link style={LinkStyle} to={ROUTE_PATH.HOME}>
              Swap
            </Link>
            <Link style={LinkStyle} to={ROUTE_PATH.LIQUIDITY}>
              Liquidity
            </Link>
            <Link style={LinkStyle} to={ROUTE_PATH.Farm}>
              Farm
            </Link>
          </Grid>
          <WalletMultiButton style={{ minWidth: '200px' }} />
        </Toolbar>
      </AppBar>
    </Box>
  )
}
