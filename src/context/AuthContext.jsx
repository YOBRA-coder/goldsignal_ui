import React, { createContext, useContext, useState, useCallback } from "react";
import api from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("gs_token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("gs_user");
    return raw ? JSON.parse(raw) : null;
  });

  const login = useCallback(async (username_or_email, password) => {
    const { data } = await api.post("/auth/login", { username_or_email, password });
    localStorage.setItem("gs_token", data.access_token);
    setToken(data.access_token);
    const prof = await api.get("/profile/me", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    localStorage.setItem("gs_user", JSON.stringify(prof.data.user));
    setUser(prof.data.user);
    return prof.data;
  }, []);

  const register = useCallback(async (payload) => {
    await api.post("/auth/register", payload);
    return login(payload.username, payload.password);
  }, [login]);

  const logout = useCallback(() => {
    localStorage.removeItem("gs_token");
    localStorage.removeItem("gs_user");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
