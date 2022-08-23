import { Raydium, RaydiumLoadParams } from '@raydium-io/raydium-sdk'
import create from 'zustand'

interface AppState {
  raydium?: Raydium
  initialing: boolean
  initRaydium: (payload: RaydiumLoadParams) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  raydium: undefined,
  initialing: false,
  initRaydium: async (payload) => {
    if (get().initialing) return

    set(() => ({ initialing: true }))
    const raydium = await Raydium.load(payload)
    set(() => ({ raydium, initialing: false }))
  },
}))
