import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
  withCredentials: true,
});

// repõe o Authorization após F5
api.interceptors.request.use((config) => {
  const t = localStorage.getItem("auth:token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});
