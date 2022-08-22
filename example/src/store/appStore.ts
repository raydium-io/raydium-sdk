import { Raydium } from '@raydium-io/raydium-sdk'
import { Connection, PublicKey } from '@solana/web3.js'
import create from 'zustand'

interface AppState {
  raydium?: Raydium
  initRaydium: (payload: { owner: PublicKey; connection: Connection }) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  raydium: undefined,
  initRaydium: async (payload) => {
    const raydium = await Raydium.load(payload)
    set(() => ({ raydium }))
  },
}))
