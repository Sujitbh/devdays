
import axios from 'axios';
import type {
  DetectionResponse,
  DetectionRecord,
  DashboardStats,
  AuthResponse,
} from '../types';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/** Axios instance pointed at the FastAPI backend */
const http = axios.create({
  baseURL: BACKEND_URL,
});

// Attach auth token to every request if available
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // ── Detection (YOLO) ──────────────────────────────────────────────────

  /**
   * Upload an image file to POST /api/detect (multipart form-data).
   * Returns bounding boxes, annotated image URL, and wildlife summary.
   */
  async detect(file: File): Promise<DetectionResponse> {
    const form = new FormData();
    form.append('file', file);

    const { data } = await http.post<DetectionResponse>('/api/detect', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    // Prefix static image paths with backend URL so they resolve correctly
    if (data.original_image && !data.original_image.startsWith('http')) {
      data.original_image = `${BACKEND_URL}${data.original_image}`;
    }
    if (data.annotated_image && !data.annotated_image.startsWith('http')) {
      data.annotated_image = `${BACKEND_URL}${data.annotated_image}`;
    }

    return data;
  },

  // ── Detection History ─────────────────────────────────────────────────

  /** Fetch all stored detection records */
  async getDetections(): Promise<DetectionRecord[]> {
    const { data } = await http.get<DetectionRecord[]>('/api/detections');
    // Prefix image URLs
    return data.map((r) => ({
      ...r,
      imageUrl: r.imageUrl?.startsWith('http') ? r.imageUrl : `${BACKEND_URL}${r.imageUrl}`,
      annotatedImageUrl: r.annotatedImageUrl?.startsWith('http')
        ? r.annotatedImageUrl
        : `${BACKEND_URL}${r.annotatedImageUrl}`,
    }));
  },

  // ── Dashboard Stats ───────────────────────────────────────────────────

  /** Fetch aggregated dashboard statistics */
  async getStats(): Promise<DashboardStats> {
    const { data } = await http.get<DashboardStats>('/api/stats');
    return data;
  },

  // ── Exports ───────────────────────────────────────────────────────────

  /** Download detections as CSV */
  async exportCSV(): Promise<void> {
    const response = await http.get('/api/exports/csv', { responseType: 'blob' });
    downloadBlob(response.data, 'pelicaneye_detections.csv', 'text/csv');
  },

  /** Download detections as GeoJSON */
  async exportGeoJSON(): Promise<void> {
    const response = await http.get('/api/exports/geojson', { responseType: 'blob' });
    downloadBlob(response.data, 'pelicaneye_detections.geojson', 'application/geo+json');
  },

  // ── Auth ──────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>('/api/auth/login', { email, password });
    return data;
  },

  async register(email: string, password: string, fullName: string): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>('/api/auth/register', {
      email,
      password,
      full_name: fullName,
    });
    return data;
  },

  /** Health check */
  async health(): Promise<{ status: string; model_loaded: boolean }> {
    const { data } = await http.get('/health');
    return data;
  },
};

/** Helper: trigger browser download from a Blob */
function downloadBlob(blob: Blob, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([blob], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
