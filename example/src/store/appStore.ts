import { Raydium, RaydiumLoadParams } from '@raydium-io/raydium-sdk'
import create from 'zustand'

interface AppState {
  raydium?: Raydium
  initialing: boolean
  initRaydium: (payload: RaydiumLoadParams) => Promise<void>
  farmLoaded: boolean
  connected: boolean
}

export const useAppStore = create<AppState>((set, get) => ({
  raydium: undefined,
  initialing: false,
  farmLoaded: false,
  connected: false,
  initRaydium: async (payload) => {
    if (get().initialing) return

    set(() => ({ initialing: true }))
    const raydium = await Raydium.load(payload)
    raydium.token.fetchTokenPrices()
    ;(window as any).raydium = raydium
    set(() => ({ raydium, initialing: false, farmLoaded: false }))
  },
  loadFarm: async () => {
    const raydium = get().raydium
    if (!raydium) return
    await raydium.farm.load()
    set(() => ({ farmLoaded: true }))
  },
}))
