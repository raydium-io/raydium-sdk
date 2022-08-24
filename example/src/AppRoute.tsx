import { Route, Routes } from 'react-router-dom'

import Farm from './features/Farm'
import Liquidity from './features/Liquidity'
import Swap from './features/Swap'

export const ROUTE_PATH = {
  HOME: '/',
  LIQUIDITY: '/pools',
  Farm: '/farms',
}

function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTE_PATH.HOME}>
        <Route index element={<Swap />} />
        <Route path={ROUTE_PATH.LIQUIDITY} element={<Liquidity />} />
        <Route path={ROUTE_PATH.Farm} element={<Farm />} />
      </Route>
      <Route path="*" element={<div>404 not found</div>} />
    </Routes>
  )
}

export default AppRoutes
