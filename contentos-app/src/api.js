import axios from "axios";

const api = axios.create({ baseURL: "/api" });

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
  generateMcpKey: (label) => api.post("/auth/mcp-key", { label }),
  getMcpKeys: () => api.get("/auth/mcp-keys"),
  revokeMcpKey: (id) => api.delete(`/auth/mcp-key/${id}`),
};

// ── Platforms ────────────────────────────────────────────────────────
export const platformApi = {
  list: () => api.get("/platforms"),
  connectYoutube: () => api.get("/platforms/youtube/connect"),
  connectInstagram: () => api.get("/platforms/instagram/connect"),
  disconnect: (id) => api.delete(`/platforms/${id}`),
};

// ── Media ────────────────────────────────────────────────────────────
export const mediaApi = {
  upload: (file, onProgress) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/media/upload?ai=true", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: onProgress,
    });
  },
  list: (page = 1) => api.get(`/media?page=${page}&limit=20`),
  delete: (id) => api.delete(`/media/${id}`),
  generateAi: (id) => api.post(`/media/${id}/generate-ai`),
};

// ── Posts ────────────────────────────────────────────────────────────
export const postApi = {
  create: (data) => api.post("/posts", data),
  list: (params = {}) => api.get("/posts", { params }),
  calendar: (year, month) => api.get(`/posts/calendar?year=${year}&month=${month}`),
  get: (id) => api.get(`/posts/${id}`),
  update: (id, data) => api.put(`/posts/${id}`, data),
  delete: (id) => api.delete(`/posts/${id}`),
};

// ── Schedules ────────────────────────────────────────────────────────
export const scheduleApi = {
  bulk: (posts) => api.post("/schedules/bulk", { posts }),
  reschedule: (id, scheduledAt) => api.patch(`/schedules/${id}/reschedule`, { scheduledAt }),
  cancel: (id) => api.patch(`/schedules/${id}/cancel`),
  aiGenerate: (topic, tone, platforms) => api.post("/schedules/ai-generate", { topic, tone, platforms }),
  aiCaption: (data) => api.post("/schedules/ai-caption", data),
  aiHashtags: (topic, platform) => api.post("/schedules/ai-hashtags", { topic, platform }),
  bestTimes: (platform) => api.get(`/schedules/best-times?platform=${platform}`),
  queueStatus: () => api.get("/schedules/queue-status"),
};

// ── Analytics ────────────────────────────────────────────────────────
export const analyticsApi = {
  overview: () => api.get("/analytics/overview"),
  youtube: (startDate, endDate) => api.get("/analytics/youtube", { params: { startDate, endDate } }),
  instagram: () => api.get("/analytics/instagram"),
  activity: () => api.get("/analytics/activity"),
};

export default api;
