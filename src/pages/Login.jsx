import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { errText } from "../lib/format";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ username_or_email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.username_or_email, form.password);
      nav("/");
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-gold to-yellow-600 flex items-center justify-center font-bold text-2xl text-black mb-3">
            G
          </div>
          <h1 className="text-2xl font-bold">
            Gold<span className="text-gold">Signal</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">Top-down multi-timeframe signals</p>
        </div>

        <form onSubmit={onSubmit} className="bg-panel border border-border rounded-2xl p-6 space-y-4">
          {error && (
            <div className="text-sm text-bear bg-bear/10 border border-bear/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="text-xs text-gray-400">Username or Email</label>
            <input
              required
              className="w-full mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 outline-none focus:border-gold"
              value={form.username_or_email}
              onChange={(e) => setForm({ ...form, username_or_email: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Password</label>
            <input
              required
              type="password"
              className="w-full mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 outline-none focus:border-gold"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button
            disabled={loading}
            className="w-full bg-gold text-black font-semibold rounded-lg py-2.5 hover:bg-yellow-400 transition-colors disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          No account?{" "}
          <Link to="/register" className="text-gold hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
