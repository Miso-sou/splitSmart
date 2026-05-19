import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '../components/shared/ProtectedRoute'
import { ROUTES } from '../constants/routes'

import Landing from '../pages/Landing'
import Login from '../pages/Login'
import Register from '../pages/Register'
import Dashboard from '../pages/Dashboard'
import GroupDetail from '../pages/GroupDetail'
import Settlement from '../pages/Settlement'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.HOME} element={<Landing />} />
      <Route path={ROUTES.LOGIN} element={<Login />} />
      <Route path={ROUTES.REGISTER} element={<Register />} />
      <Route
        path={ROUTES.DASHBOARD}
        element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
      />
      <Route
        path={ROUTES.GROUP}
        element={<ProtectedRoute><GroupDetail /></ProtectedRoute>}
      />
      <Route
        path={ROUTES.SETTLEMENT}
        element={<ProtectedRoute><Settlement /></ProtectedRoute>}
      />
      <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
    </Routes>
  )
}
