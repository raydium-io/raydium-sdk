import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import {
  getAssociatedPoolKeys,
  LiquidityPoolJsonInfo,
  Percent,
  SPL_MINT_LAYOUT,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk'
import { useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { useEffect } from 'react'

import { useAppStore } from '../store/appStore'

export default function Liquidity() {
  const { connection } = useConnection()
  const raydium = useAppStore((state) => state.raydium)
  const connected = useAppStore((state) => state.connected)

  const handleClickAdd = async (pool: LiquidityPoolJsonInfo) => {
    const { transaction, signers, execute } = await raydium!.liquidity.addLiquidity({
      poolId: new PublicKey(pool.id),
      amountInA: raydium!.mintToTokenAmount({ mint: pool.baseMint, amount: '20' }),
      amountInB: raydium!.mintToTokenAmount({ mint: pool.quoteMint, amount: '30' }),
      fixedSide: 'a',
    })
    // const txId = await execute()
  }

  const handleClickRemove = async (pool: LiquidityPoolJsonInfo) => {
    const { transaction, signers, execute } = await raydium!.liquidity.removeLiquidity({
      poolId: new PublicKey(pool.id),
      amountIn: raydium!.mintToTokenAmount({ mint: pool.baseMint, amount: '20' }),
    })
    // const txId = await execute()
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

  useEffect(() => {
    async function calculateLiquidityAmount() {
      // RAY - SOL pool
      const poolId = 'AVs9TA4nWDzfPJE9gGVNJMVhcQy3V9PGazuz33BfG2RA'
      const poolInfo = raydium?.liquidity.allPoolMap.get(poolId)

      // use USDC as fixed input
      const baseTokenAmount = raydium!.mintToTokenAmount({ mint: poolInfo!.baseMint, amount: 0.5 })

      const res = await raydium!.liquidity.computePairAmount({
        poolId, // deUITokenAmount(coin2TokenAmount)
        amount: baseTokenAmount,
        anotherCurrency: raydium!.mintToToken(poolInfo!.quoteMint),
        slippage: new Percent(1, 100),
      })
      /*
       * add
       */
      const { execute, transaction } = await raydium!.liquidity.addLiquidity({
        poolId,
        amountInA: baseTokenAmount,
        amountInB: res.maxAnotherAmount,
        fixedSide: 'a', // a means base mint is input by user, b is calculated by sdk
      })
      // const txId = await execute()
      /*
       * remove
      const lpTokenAmount = raydium!.liquidity.lpMintToTokenAmount({ poolId, amount: lpAmount })
      const { execute, transaction } = await raydium!.liquidity.removeLiquidity({
        poolId: poolId,
        amountIn: lpTokenAmount,
      })
      const txId = await execute()
      */
    }
    connected && calculateLiquidityAmount()
  }, [raydium, connected])

  useEffect(() => {
    async function createPool() {
      const poolBaseMint = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'
      const poolQuoteMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      const marketId = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      const { transaction } = await raydium!.liquidity.createPool({
        version: 4,
        baseMint: poolBaseMint,
        quoteMint: poolQuoteMint,
        marketId,
      })

      // const { transaction, execute } = await raydium!.liquidity.initPool({
      //   version: 4,
      //   baseMint: poolBaseMint,
      //   quoteMint: poolQuoteMint,
      //   baseAmount: raydium!.mintToTokenAmount({ mint: poolBaseMint, amount: 1 }),
      //   quoteAmount: raydium!.mintToTokenAmount({ mint: poolQuoteMint, amount: 1 }),
      //   marketId,
      // })
      // const txId = await execute()
    }
    connected && createPool()
  }, [raydium, connected])

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
