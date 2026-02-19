
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
   * Optionally pass a confidence threshold (0.05–0.95).
   * Returns bounding boxes, annotated image URL, and wildlife summary.
   */
  async detect(file: File, confThreshold?: number): Promise<DetectionResponse> {
    const form = new FormData();
    form.append('file', file);
    if (confThreshold !== undefined) {
      form.append('conf_threshold', confThreshold.toString());
    }

    console.log('[PelicanEye] 📤 Uploading:', file.name, `(${(file.size / 1024).toFixed(0)} KB)`, 'threshold:', confThreshold ?? 'default');

    const { data } = await http.post<DetectionResponse>('/api/detect', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    console.log('[PelicanEye] 📥 Response:', {
      success: data.success,
      total_detections: data.total_detections,
      detections: data.detections,
      summary: data.summary,
      annotated_image: data.annotated_image,
    });

    // Prefix static image paths with backend URL so they resolve correctly
    if (data.original_image && !data.original_image.startsWith('http')) {
      data.original_image = `${BACKEND_URL}${data.original_image}`;
    }
    if (data.annotated_image && !data.annotated_image.startsWith('http')) {
      data.annotated_image = `${BACKEND_URL}${data.annotated_image}`;
    }
    if (data.heatmap_image && !data.heatmap_image.startsWith('http')) {
      data.heatmap_image = `${BACKEND_URL}${data.heatmap_image}`;
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

  /** Download detections as CSV with optional filters */
  async exportCSV(options?: {
    species?: string;
    habitat?: string;
    minConfidence?: number;
    dateFrom?: string;
    dateTo?: string;
    includeBoxes?: boolean;
  }): Promise<void> {
    const params = new URLSearchParams();
    if (options?.species) params.set('species', options.species);
    if (options?.habitat) params.set('habitat', options.habitat);
    if (options?.minConfidence !== undefined) params.set('min_confidence', options.minConfidence.toString());
    if (options?.dateFrom) params.set('date_from', options.dateFrom);
    if (options?.dateTo) params.set('date_to', options.dateTo);
    if (options?.includeBoxes) params.set('include_boxes', 'true');

    const qs = params.toString();
    const url = `/api/exports/csv${qs ? `?${qs}` : ''}`;
    const response = await http.get(url, { responseType: 'blob' });

    const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    downloadBlob(response.data, `pelicaneye_report_${ts}.csv`, 'text/csv');
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
