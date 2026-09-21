import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Signals from "./pages/Signals.jsx";
import Charts from "./pages/Charts.jsx";
import Market from "./pages/Market.jsx";
import Backtest from "./pages/Backtest.jsx";
import Profile from "./pages/Profile.jsx";

function Private({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <Private>
            <Layout />
          </Private>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="charts" element={<Charts />} />
        <Route path="market" element={<Market />} />
        <Route path="signals" element={<Signals />} />
        <Route path="history" element={<Navigate to="/signals" replace />} />
        <Route path="backtest" element={<Backtest />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
