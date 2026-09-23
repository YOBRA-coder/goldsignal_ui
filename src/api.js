import axios from "axios";

const api = axios.create({ baseURL: "/api",  timeout: 60000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("gs_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && !window.location.pathname.startsWith("/login")) {
      localStorage.removeItem("gs_token");
      localStorage.removeItem("gs_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
