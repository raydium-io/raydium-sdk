import { Route, Routes } from 'react-router-dom'

import Liquidity from './features/Liquidity'
import Swap from './features/Swap'

export const ROUTE_PATH = {
  HOME: '/',
  LIQUIDITY: '/pools',
}

function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTE_PATH.HOME}>
        <Route index element={<Swap />} />
        <Route path={ROUTE_PATH.LIQUIDITY} element={<Liquidity />} />
      </Route>
      <Route path="*" element={<div>404 not found</div>} />
    </Routes>
  )
}

export default AppRoutes
