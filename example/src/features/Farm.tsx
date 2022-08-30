import { PublicKey } from '@solana/web3.js'
import { useEffect } from 'react'

import { useAppStore } from '../store/appStore'

export default function Farm() {
  const raydium = useAppStore((s) => s.raydium)
  const connected = useAppStore((s) => s.connected)

  useEffect(() => {
    async function addFarm() {
      if (!raydium) return
      await raydium.farm.load()

      // ray - sol farm
      // const farmId = 'GUzaohfNuFbBqQTnPgPSNciv3aUvriXYjQduRE3ZkqFw'

      // const targetFarm = raydium.farm.getParsedFarm(farmId)

      // const { execute, transaction } = await raydium.farm.deposit({
      //   farmId: new PublicKey(farmId),
      //   amount: raydium.farm.lpDecimalAmount({
      //     mint: targetFarm.lpMint,
      //     amount: '0.346683',
      //   }),
      // })

      // const { execute, transaction } = await raydium.farm.withdraw({
      //   farmId: new PublicKey(farmId),
      //   amount: 0,
      // })

      // usdt-usdc pool: 2EXiumdi14E9b8Fy62QcA5Uh6WdHS2b38wtSxp72Mibj
      const { execute, transaction, signers } = await raydium.farm.create({
        poolId: new PublicKey('2EXiumdi14E9b8Fy62QcA5Uh6WdHS2b38wtSxp72Mibj'),
        rewardInfos: [
          {
            rewardMint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
            rewardPerSecond: 1,
            rewardOpenTime: 1661419500,
            rewardEndTime: 1662024300,
            rewardType: 'Standard SPL',
          },
        ],
      })

      // execute()
    }
    connected && addFarm()
  }, [raydium, connected])
  return <div>Farm</div>
}
