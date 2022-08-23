import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import { getAssociatedPoolKeys, LiquidityPoolJsonInfo, SPL_MINT_LAYOUT } from '@raydium-io/raydium-sdk'
import { useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'

import { useAppStore } from '../store/appStore'

export default function Liquidity() {
  const { connection } = useConnection()
  const raydium = useAppStore((state) => state.raydium)

  const handleClickAdd = async (pool: LiquidityPoolJsonInfo) => {
    const { transaction, signers, execute } = await raydium!.liquidity.addLiquidity({
      poolId: new PublicKey(pool.id),
      amountInA: raydium!.mintToTokenAmount({ mint: pool.baseMint, amount: '20' }),
      amountInB: raydium!.mintToTokenAmount({ mint: pool.quoteMint, amount: '30' }),
      fixedSide: 'a',
    })
    const txId = execute()
  }

  const handleClickRemove = async (pool: LiquidityPoolJsonInfo) => {
    const { transaction, signers, execute } = await raydium!.liquidity.removeLiquidity({
      poolId: new PublicKey(pool.id),
      amountIn: raydium!.mintToTokenAmount({ mint: pool.baseMint, amount: '20' }),
    })
    const txId = execute()
  }

  const handleClickCreate = async (pool: LiquidityPoolJsonInfo) => {
    // change to your ids
    const baseMint = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'
    const quoteMint = '4SZjjNABoqhbd4hnapbvoEPEqT8mnNkfbEoAwALf1V8t'
    const marketId = 'pool fake id'

    const associatedPoolKeys = await getAssociatedPoolKeys({
      version: 4,
      baseMint,
      quoteMint,
      marketId,
    })
    const { id: ammId, lpMint } = associatedPoolKeys
    const lpMintInfoOnChain = (await connection.getAccountInfo(new PublicKey(lpMint)))?.data

    const isAlreadyCreated = Boolean(
      lpMintInfoOnChain?.length && Number(SPL_MINT_LAYOUT.decode(lpMintInfoOnChain).supply) === 0
    )

    if (!isAlreadyCreated) {
      const { transaction, signers, execute } = await raydium!.liquidity.createPool({
        version: 4,
        baseMint,
        quoteMint,
        marketId,
      })
      const txId = execute()
    }
    const { transaction, signers, execute } = await raydium!.liquidity.initPool({
      version: 4,
      baseMint,
      quoteMint,
      marketId,
      baseAmount: raydium!.mintToTokenAmount({ mint: baseMint, amount: 20 }),
      quoteAmount: raydium!.mintToTokenAmount({ mint: quoteMint, amount: 20 }),
    })
    const txId = execute()
  }

  if (!raydium) return <CircularProgress />

  return (
    <>
      <Typography variant="h5" sx={{ mt: '20px' }}>
        Liquidity Pools (demo show 20 pools only)
      </Typography>
      <List sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}>
        {raydium.liquidity.allPools.slice(0, 20).map((pool) => (
          <ListItem key={pool.id}>
            <ListItemText
              primary={
                <>
                  {raydium.token.allTokenMap.get(pool.baseMint)?.symbol} - $
                  {raydium.token.allTokenMap.get(pool.quoteMint)?.symbol}
                  <Button sx={{ m: '5px' }} size="small" variant="contained" onClick={() => handleClickAdd(pool)}>
                    Deposit
                  </Button>
                  <Button sx={{ m: '5px' }} size="small" variant="outlined" onClick={() => handleClickRemove(pool)}>
                    Withdraw
                  </Button>
                </>
              }
              secondary={pool.id}
            />
          </ListItem>
        ))}
      </List>
    </>
  )
}
