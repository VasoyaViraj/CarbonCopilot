import { createBrowserRouter, Navigate } from "react-router"
import AppLayout from "@/layouts/AppLayout"
import ProtectedRoute from "@/components/routing/ProtectedRoute"
import LoginPage from "@/pages/LoginPage"
import FactorySetupPage from "@/pages/FactorySetupPage"
import DataInputPage from "@/pages/DataInputPage"
import DashboardPage from "@/pages/DashboardPage"
import HotspotsPage from "@/pages/HotspotsPage"
import RecommendationsPage from "@/pages/RecommendationsPage"
import ScenariosPage from "@/pages/ScenariosPage"
import CopilotPage from "@/pages/CopilotPage"
import ReportsPage from "@/pages/ReportsPage"
import NotFoundPage from "@/pages/NotFoundPage"

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "factory", element: <FactorySetupPage /> },
      { path: "data", element: <DataInputPage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "hotspots", element: <HotspotsPage /> },
      { path: "recommendations", element: <RecommendationsPage /> },
      { path: "scenarios", element: <ScenariosPage /> },
      { path: "copilot", element: <CopilotPage /> },
      { path: "reports", element: <ReportsPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
])
