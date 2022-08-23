import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import OutlinedInput from '@mui/material/OutlinedInput'
import { Percent, RouteInfo, RouteType, TokenAmount } from '@raydium-io/raydium-sdk'
import debounce from 'lodash/debounce'
import { useEffect, useState } from 'react'

import { useAppStore } from '../store/appStore'

export default function Swap() {
  const raydium = useAppStore((state) => state.raydium)
  const [inAmount, setInAmount] = useState<string>('')
  const [outAmount, setOutAmount] = useState<TokenAmount>()
  const [minOutAmount, setMinOutAmount] = useState<TokenAmount>()
  const [routes, setRoutes] = useState<RouteInfo[]>([])
  const [routeType, setRouteType] = useState<RouteType>('amm')
  const [loading, setLoading] = useState<boolean>(false)

  // ray mint: 4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R
  // sol => sdk will auto recognize it
  const [inToken, outToken] = ['sol', '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R']

  useEffect(() => {
    async function calculateAmount() {
      if (!inAmount || Number(inAmount) < 1) {
        setOutAmount(undefined)
        return
      }
      setLoading(true)
      /**
       * call getAvailablePools is optional, if you want to choose swap route by self
       *
       * return pool options: { availablePools, best, routedPools }, default will choose routedPools
       */
      const { routedPools } = await raydium!.trade.getAvailablePools({
        inputMint: inToken,
        outputMint: outToken,
      })!

      if (!inAmount) {
        setLoading(false)
        return
      }

      const {
        amountOut: _amountOut,
        minAmountOut,
        routes,
        routeType,
      } = await raydium!.trade.getBestAmountOut({
        pools: routedPools, // optional, pass only if called getAvailablePools
        amountIn: raydium!.decimalAmount({ mint: inToken, amount: inAmount })!,
        inputToken: raydium!.mintToToken(inToken),
        outputToken: raydium!.mintToToken(outToken),
        slippage: new Percent(1, 100),
      })!
      setOutAmount(_amountOut)
      setMinOutAmount(minAmountOut)
      setRouteType(routeType)
      setRoutes(routes)
      setLoading(false)
    }

    const debounceCalculate = debounce(() => {
      calculateAmount()
    }, 500)

    if (raydium && inToken && outToken) {
      debounceCalculate()
    }

    return () => debounceCalculate.cancel()
  }, [raydium, inToken, outToken, inAmount])

  const handleClick = async () => {
    const { transaction, signers, execute } = await raydium!.trade.swap({
      routes,
      routeType,
      amountIn: raydium!.mintToTokenAmount({ mint: inToken, amount: inAmount })!,
      amountOut: minOutAmount!,
      fixedSide: 'in',
    })
    const txId = execute()

    /**
     * if you don't care about route/out amount, you can just call directSwap to execute swap
     */
    // const { transaction, signers, execute } = await raydium!.trade.directSwap({
    //   amountOut: raydium!.mintToTokenAmount({ mint: outToken, amount: '0' })!,
    //   amountIn: raydium!.mintToTokenAmount({ mint: inToken, amount: inAmount })!,
    //   fixedSide: 'in',
    //   slippage: new Percent(1, 100),
    // })
    // const txId = execute()
  }

  const [inTokenInfo, outTokenInfo] = [
    raydium?.token.allTokenMap.get(inToken),
    raydium?.token.allTokenMap.get(outToken),
  ]

  return (
    <div>
      <Box sx={{ maxWidth: 300 }}>
        {inTokenInfo ? (
          <Grid container alignItems="center" my="20px">
            <Grid>
              <Avatar
                sx={{ mr: '10px' }}
                alt={inTokenInfo.symbol}
                src={inTokenInfo.icon}
                imgProps={{ loading: 'lazy' }}
              />
            </Grid>
            <Grid>{inTokenInfo.symbol}</Grid>
          </Grid>
        ) : null}
        <div>Amount In</div>
        <OutlinedInput
          type="number"
          value={inAmount}
          onChange={(e) => setInAmount(e.target.value)}
          // label="Amount In"
          // variant="outlined"
        />
        <Grid container alignItems="center" my="20px">
          {outTokenInfo ? (
            <>
              <Grid>
                <Avatar
                  sx={{ mr: '10px' }}
                  alt={outTokenInfo.symbol}
                  src={outTokenInfo.icon}
                  imgProps={{ loading: 'lazy' }}
                />
              </Grid>
              <Grid>{outTokenInfo.symbol}</Grid>
            </>
          ) : null}
        </Grid>
        <div>Amount Out</div>
        <OutlinedInput
          type="number"
          value={outAmount?.toSignificant() || ''}
          // label="Amount Out"
          // variant="outlined"
          startAdornment={loading ? <CircularProgress /> : undefined}
          disabled
        />
        <div>min amount out: {minOutAmount?.toSignificant()}</div>
      </Box>
      <Button variant="contained" sx={{ mt: '20px' }} onClick={handleClick}>
        Swap
      </Button>
    </div>
  )
}
