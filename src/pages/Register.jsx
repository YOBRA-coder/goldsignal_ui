import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: "", username: "", email: "", password: "", confirm_password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm_password) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await register(form);
      nav("/");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(Array.isArray(detail) ? detail[0]?.msg : detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const field = (label, key, type = "text") => (
    <div>
      <label className="text-xs text-gray-400">{label}</label>
      <input
        required
        type={type}
        className="w-full mt-1 bg-panel2 border border-border rounded-lg px-3 py-2 outline-none focus:border-gold"
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-gold to-yellow-600 flex items-center justify-center font-bold text-2xl text-black mb-3">
            G
          </div>
          <h1 className="text-2xl font-bold">Create your account</h1>
        </div>

        <form onSubmit={onSubmit} className="bg-panel border border-border rounded-2xl p-6 space-y-4">
          {error && (
            <div className="text-sm text-bear bg-bear/10 border border-bear/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {field("Full name", "name")}
          {field("Username", "username")}
          {field("Email", "email", "email")}
          {field("Password", "password", "password")}
          {field("Confirm password", "confirm_password", "password")}
          <button
            disabled={loading}
            className="w-full bg-gold text-black font-semibold rounded-lg py-2.5 hover:bg-yellow-400 transition-colors disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-gold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
