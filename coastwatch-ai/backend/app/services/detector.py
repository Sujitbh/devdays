"""
PelicanEye - Advanced YOLO Detection Service

Multi-scale sliced inference (SAHI-style) for tiny-object detection,
spatial clustering for colony/herd analysis, density heatmaps, and
robust annotation rendering.
"""

import logging
import math
import time
from pathlib import Path
from collections import Counter

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from ultralytics import YOLO

from app.config import CONFIDENCE_THRESHOLD, RESULTS_DIR, YOLO_MODEL
from app.models.detection import BoundingBox, SpatialCluster

logger = logging.getLogger("pelicaneye.detector")

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Sliced inference settings
DEFAULT_IMGSZ        = 1280     # Base inference resolution
SLICE_OVERLAP_RATIO  = 0.25     # 25 % overlap between tiles
SLICE_MIN_DIMENSION  = 2000     # only slice images bigger than this
MERGE_IOU_THRESHOLD  = 0.50     # NMS threshold when merging slices
DEFAULT_IOU          = 0.45     # NMS IoU inside each slice

# Multi-scale passes
MULTI_SCALE_SIZES    = [640, 1280]  # run at 640 + 1280

# Tiny-object threshold
TINY_OBJ_PIXELS      = 32 * 32  # < 1024px² = tiny

# Spatial clustering (DBSCAN-lite)
CLUSTER_RADIUS_PX    = 200      # max px between neighbours
CLUSTER_MIN_MEMBERS  = 2

# ── Wildlife & habitat class filter ──────────────────────────────────────────
ALLOWED_CLASSES = {
    "bird", "cat", "dog", "horse", "sheep", "cow",
    "elephant", "bear", "zebra", "giraffe",
}
CONTEXT_CLASSES = {
    "boat", "person", "car", "truck", "bus", "airplane",
    "ship", "surfboard", "kite",
}
ALLOWED_KEYWORDS = {
    "bird", "nest", "pelican", "heron", "egret", "ibis", "tern",
    "deer", "alligator", "turtle", "dolphin", "manatee", "fish",
    "coyote", "raccoon", "nutria", "otter", "snake", "frog",
    "wildlife", "animal", "mammal", "reptile",
}


def _is_relevant(cls_name: str) -> bool:
    """Check whether a YOLO class is wildlife/habitat-relevant."""
    low = cls_name.lower()
    return (
        low in ALLOWED_CLASSES
        or low in CONTEXT_CLASSES
        or any(kw in low for kw in ALLOWED_KEYWORDS)
    )


# ═══════════════════════════════════════════════════════════════════════════════
# DETECTOR SERVICE
# ═══════════════════════════════════════════════════════════════════════════════

class DetectorService:
    """Advanced detection service: SAHI slicing, multi-scale, spatial clustering."""

    def __init__(self) -> None:
        self.model: YOLO | None = None
        self._model_path: str = YOLO_MODEL

    # ── Model lifecycle ──────────────────────────────────────────────────────

    def load_model(self) -> None:
        print(f"[PelicanEye] Loading YOLO model: {self._model_path}")
        self.model = YOLO(self._model_path)
        print(f"[PelicanEye] Model loaded — {len(self.model.names)} classes")
        print(f"[PelicanEye] Class map: {self.model.names}")

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    # ── Public entry point ───────────────────────────────────────────────────

    def detect(
        self,
        image_path: Path,
        conf_threshold: float | None = None,
    ) -> tuple[list[BoundingBox], Path, dict, list[SpatialCluster], Path | None]:
        """
        Advanced detection pipeline.

        Returns:
            detections      – deduplicated BoundingBox list
            annotated_path  – annotated result image
            debug_info      – diagnostic dict
            clusters        – spatial clusters
            heatmap_path    – density heatmap image (or None)
        """
        if not self.is_loaded:
            raise RuntimeError("YOLO model is not loaded. Call load_model() first.")

        t0 = time.perf_counter()
        threshold = conf_threshold if conf_threshold is not None else CONFIDENCE_THRESHOLD

        # ── Pre-inference diagnostics ────────────────────────────────────
        pil_img = Image.open(image_path)
        orig_w, orig_h = pil_img.size
        img_mode = pil_img.mode
        img_area = orig_w * orig_h
        pil_img.close()

        logger.info("=" * 60)
        logger.info("🔍 ADVANCED PIPELINE START")
        logger.info("  Image      : %s (%d×%d, %s)", image_path.name, orig_w, orig_h, img_mode)
        logger.info("  conf=%.3f  iou=%.2f", threshold, DEFAULT_IOU)

        # ── Step 1: Decide strategy ──────────────────────────────────────
        use_slicing = max(orig_w, orig_h) >= SLICE_MIN_DIMENSION
        sliced = False
        slice_grid = ""
        total_slices = 0

        if use_slicing:
            all_raw, sliced, slice_grid, total_slices = self._sliced_inference(
                image_path, threshold, orig_w, orig_h,
            )
        else:
            all_raw = self._multi_scale_inference(image_path, threshold)

        pre_nms = len(all_raw)
        logger.info("  Pre-NMS boxes: %d  (sliced=%s)", pre_nms, sliced)

        # ── Step 2: Cross-scale / cross-slice NMS ────────────────────────
        detections = self._global_nms(all_raw, MERGE_IOU_THRESHOLD)
        logger.info("  Post-NMS boxes: %d", len(detections))

        # ── Step 3: Enrich with area metrics ─────────────────────────────
        tiny_count = 0
        for d in detections:
            box_area = (d.x2 - d.x1) * (d.y2 - d.y1)
            d.area_px = round(box_area, 1)
            d.area_pct = round(box_area / img_area * 100, 4) if img_area else 0
            if box_area < TINY_OBJ_PIXELS:
                tiny_count += 1

        # ── Step 4: Spatial clustering ───────────────────────────────────
        clusters = self._cluster_detections(detections)
        logger.info("  Spatial clusters: %d", len(clusters))

        # ── Step 5: Heatmap ──────────────────────────────────────────────
        heatmap_path = self._generate_heatmap(image_path, detections, orig_w, orig_h)

        # ── Step 6: Annotated image ──────────────────────────────────────
        annotated_path = self._draw_annotations(image_path, detections, clusters)

        elapsed_ms = (time.perf_counter() - t0) * 1000
        logger.info("✅ Pipeline done in %.0f ms — %d detections, %d clusters",
                     elapsed_ms, len(detections), len(clusters))
        logger.info("=" * 60)

        # ── Debug info ───────────────────────────────────────────────────
        debug_info = {
            "raw_box_count": pre_nms,
            "final_box_count": len(detections),
            "imgsz_used": DEFAULT_IMGSZ,
            "conf_used": round(threshold, 4),
            "iou_used": DEFAULT_IOU,
            "model_name": self._model_path,
            "image_width": orig_w,
            "image_height": orig_h,
            "image_mode": img_mode,
            "class_names": list(self.model.names.values()),
            "inference_ms": round(elapsed_ms, 1),
            "sliced_inference": sliced,
            "slice_grid": slice_grid,
            "total_slices": total_slices,
            "merge_strategy": "NMS",
            "pre_nms_count": pre_nms,
            "post_nms_count": len(detections),
            "tiny_object_count": tiny_count,
            "spatial_clusters": len(clusters),
        }

        return detections, annotated_path, debug_info, clusters, heatmap_path

    # ═════════════════════════════════════════════════════════════════════════
    # INFERENCE STRATEGIES
    # ═════════════════════════════════════════════════════════════════════════

    def _multi_scale_inference(
        self, image_path: Path, threshold: float,
    ) -> list[BoundingBox]:
        """Run YOLO at multiple resolutions and collect all boxes."""
        all_boxes: list[BoundingBox] = []
        for sz in MULTI_SCALE_SIZES:
            boxes = self._run_yolo(image_path, threshold, sz)
            all_boxes.extend(boxes)
            logger.info("    Scale %d → %d boxes", sz, len(boxes))
        return all_boxes

    def _sliced_inference(
        self,
        image_path: Path,
        threshold: float,
        w: int,
        h: int,
    ) -> tuple[list[BoundingBox], bool, str, int]:
        """
        SAHI-style sliced inference: tile the image into overlapping slices,
        run YOLO on each tile, then map coordinates back to the full image.
        Also runs a full-image pass for large objects.
        """
        slice_size = DEFAULT_IMGSZ
        overlap = int(slice_size * SLICE_OVERLAP_RATIO)
        step = slice_size - overlap

        cols = max(1, math.ceil((w - overlap) / step))
        rows = max(1, math.ceil((h - overlap) / step))
        grid = f"{rows}x{cols}"
        total = rows * cols

        logger.info("  SAHI slicing: %s grid (%d tiles), slice=%d, overlap=%d",
                     grid, total, slice_size, overlap)

        pil_img = Image.open(image_path).convert("RGB")
        all_boxes: list[BoundingBox] = []

        for r in range(rows):
            for c in range(cols):
                x0 = min(c * step, w - slice_size) if w > slice_size else 0
                y0 = min(r * step, h - slice_size) if h > slice_size else 0
                x1 = min(x0 + slice_size, w)
                y1 = min(y0 + slice_size, h)

                tile = pil_img.crop((x0, y0, x1, y1))
                # Save tile to temp location
                tile_path = RESULTS_DIR / f"_tile_{r}_{c}.jpg"
                tile.save(tile_path, quality=95)

                # Run YOLO on tile
                tile_boxes = self._run_yolo(tile_path, threshold, DEFAULT_IMGSZ)

                # Map tile coords → full image coords
                for b in tile_boxes:
                    b.x1 += x0
                    b.y1 += y0
                    b.x2 += x0
                    b.y2 += y0

                all_boxes.extend(tile_boxes)
                tile_path.unlink(missing_ok=True)

        pil_img.close()

        # Also run a full-image pass at 640 to catch large subjects
        full_boxes = self._run_yolo(image_path, threshold, 640)
        all_boxes.extend(full_boxes)
        logger.info("  Full-image pass (640) → %d boxes", len(full_boxes))

        return all_boxes, True, grid, total

    def _run_yolo(
        self, source: Path, threshold: float, imgsz: int,
    ) -> list[BoundingBox]:
        """Single YOLO inference call with wildlife filtering."""
        results = self.model.predict(
            source=str(source),
            conf=threshold,
            iou=DEFAULT_IOU,
            imgsz=imgsz,
            verbose=False,
        )
        result = results[0]
        detections: list[BoundingBox] = []
        for box in result.boxes:
            coords = box.xyxy[0].tolist()
            cls_id = int(box.cls[0])
            cls_name = self.model.names[cls_id]
            conf = float(box.conf[0])
            if _is_relevant(cls_name):
                detections.append(BoundingBox(
                    x1=coords[0], y1=coords[1],
                    x2=coords[2], y2=coords[3],
                    confidence=conf, class_id=cls_id, class_name=cls_name,
                ))
        return detections

    # ═════════════════════════════════════════════════════════════════════════
    # GLOBAL NMS (deduplicate across scales / slices)
    # ═════════════════════════════════════════════════════════════════════════

    @staticmethod
    def _global_nms(boxes: list[BoundingBox], iou_thresh: float) -> list[BoundingBox]:
        """Greedy NMS over all collected boxes, keeping highest confidence."""
        if not boxes:
            return []
        # Sort by confidence descending
        sorted_boxes = sorted(boxes, key=lambda b: b.confidence, reverse=True)
        keep: list[BoundingBox] = []

        for candidate in sorted_boxes:
            suppressed = False
            for kept in keep:
                if _iou(candidate, kept) > iou_thresh:
                    suppressed = True
                    break
            if not suppressed:
                keep.append(candidate)
        return keep

    # ═════════════════════════════════════════════════════════════════════════
    # SPATIAL CLUSTERING (DBSCAN-lite)
    # ═════════════════════════════════════════════════════════════════════════

    @staticmethod
    def _cluster_detections(boxes: list[BoundingBox]) -> list[SpatialCluster]:
        """Simple density-based clustering of detection centroids."""
        if len(boxes) < CLUSTER_MIN_MEMBERS:
            return []

        centroids = [((b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2) for b in boxes]
        n = len(centroids)
        visited = [False] * n
        clusters: list[list[int]] = []

        for i in range(n):
            if visited[i]:
                continue
            # Find all neighbours
            neighbours = [i]
            visited[i] = True
            queue = [i]
            while queue:
                cur = queue.pop(0)
                cx, cy = centroids[cur]
                for j in range(n):
                    if visited[j]:
                        continue
                    jx, jy = centroids[j]
                    dist = math.sqrt((cx - jx) ** 2 + (cy - jy) ** 2)
                    if dist <= CLUSTER_RADIUS_PX:
                        visited[j] = True
                        neighbours.append(j)
                        queue.append(j)
            if len(neighbours) >= CLUSTER_MIN_MEMBERS:
                clusters.append(neighbours)

        result: list[SpatialCluster] = []
        for cid, members in enumerate(clusters):
            pts = [centroids[m] for m in members]
            cx = sum(p[0] for p in pts) / len(pts)
            cy = sum(p[1] for p in pts) / len(pts)
            spread = max(math.sqrt((p[0] - cx) ** 2 + (p[1] - cy) ** 2) for p in pts)
            class_counts = Counter(boxes[m].class_name for m in members)
            dominant = class_counts.most_common(1)[0][0]
            avg_conf = sum(boxes[m].confidence for m in members) / len(members)
            area = math.pi * max(spread, 1) ** 2
            density = len(members) / (area / 1000)

            result.append(SpatialCluster(
                cluster_id=cid,
                centroid_x=round(cx, 1),
                centroid_y=round(cy, 1),
                member_count=len(members),
                dominant_class=dominant,
                avg_confidence=round(avg_conf, 3),
                spread_px=round(spread, 1),
                density=round(density, 4),
            ))
        return result

    # ═════════════════════════════════════════════════════════════════════════
    # HEATMAP GENERATION
    # ═════════════════════════════════════════════════════════════════════════

    @staticmethod
    def _generate_heatmap(
        image_path: Path,
        detections: list[BoundingBox],
        w: int, h: int,
    ) -> Path | None:
        """Generate a density heatmap overlay."""
        if not detections:
            return None

        # Create density array at reduced resolution
        scale = 4
        sw, sh = w // scale, h // scale
        density = np.zeros((sh, sw), dtype=np.float32)

        for d in detections:
            cx = int(((d.x1 + d.x2) / 2) / scale)
            cy = int(((d.y1 + d.y2) / 2) / scale)
            cx = max(0, min(sw - 1, cx))
            cy = max(0, min(sh - 1, cy))
            # Gaussian-ish splat
            radius = 20
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < sh and 0 <= nx < sw:
                        dist = math.sqrt(dx * dx + dy * dy)
                        if dist <= radius:
                            density[ny, nx] += d.confidence * (1 - dist / radius)

        # Normalize
        max_val = density.max()
        if max_val > 0:
            density = density / max_val

        # Build RGBA heatmap
        hm = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
        pixels = hm.load()
        for y in range(sh):
            for x in range(sw):
                v = density[y, x]
                if v < 0.01:
                    continue
                # Blue → Cyan → Green → Yellow → Red
                if v < 0.25:
                    r, g, b = 0, int(v * 4 * 255), 255
                elif v < 0.50:
                    r, g, b = 0, 255, int((1 - (v - 0.25) * 4) * 255)
                elif v < 0.75:
                    r, g, b = int((v - 0.5) * 4 * 255), 255, 0
                else:
                    r, g, b = 255, int((1 - (v - 0.75) * 4) * 255), 0
                alpha = int(min(v * 2, 1.0) * 180)
                pixels[x, y] = (r, g, b, alpha)

        # Scale up and composite
        hm = hm.resize((w, h), Image.BILINEAR)
        base = Image.open(image_path).convert("RGBA")
        composite = Image.alpha_composite(base, hm)
        composite = composite.convert("RGB")

        out_path = RESULTS_DIR / f"heatmap_{image_path.name}"
        composite.save(out_path, quality=92)
        base.close()
        return out_path

    # ═════════════════════════════════════════════════════════════════════════
    # ANNOTATION DRAWING
    # ═════════════════════════════════════════════════════════════════════════

    @staticmethod
    def _draw_annotations(
        image_path: Path,
        detections: list[BoundingBox],
        clusters: list[SpatialCluster],
    ) -> Path:
        """Rich annotated image with boxes, cluster outlines, and stats overlay."""
        img = Image.open(image_path).convert("RGB")
        draw = ImageDraw.Draw(img, "RGBA")

        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size=16)
            font_sm = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size=12)
        except OSError:
            font = ImageFont.load_default()
            font_sm = font

        animal_colors = [
            "#FF3838", "#FF9D97", "#FF701F", "#FFB21D", "#CFD231",
            "#48F90A", "#92CC17", "#3DDB86", "#1A9334", "#00D4BB",
        ]
        context_color = "#6366f1"

        # Draw cluster ellipses first (behind boxes)
        for cl in clusters:
            r = max(cl.spread_px, 30)
            cx, cy = cl.centroid_x, cl.centroid_y
            draw.ellipse(
                [cx - r, cy - r, cx + r, cy + r],
                outline="#facc15",
                width=2,
            )
            draw.ellipse(
                [cx - r - 4, cy - r - 4, cx + r + 4, cy + r + 4],
                fill=(250, 204, 21, 30),
            )
            label = f"Cluster {cl.cluster_id + 1}: {cl.member_count} {cl.dominant_class}"
            draw.text((cx - r, cy - r - 16), label, fill="#facc15", font=font_sm)

        # Draw detection boxes
        for det in detections:
            is_ctx = det.class_name.lower() in CONTEXT_CLASSES
            color = context_color if is_ctx else animal_colors[det.class_id % len(animal_colors)]
            box_area = (det.x2 - det.x1) * (det.y2 - det.y1)
            is_tiny = box_area < TINY_OBJ_PIXELS
            width = 2 if is_tiny else 3

            draw.rectangle([det.x1, det.y1, det.x2, det.y2], outline=color, width=width)

            # Corner accents for tiny objects
            if is_tiny:
                L = 8
                for cx, cy in [(det.x1, det.y1), (det.x2, det.y1), (det.x1, det.y2), (det.x2, det.y2)]:
                    draw.line([(cx - L, cy), (cx + L, cy)], fill="#facc15", width=2)
                    draw.line([(cx, cy - L), (cx, cy + L)], fill="#facc15", width=2)

            label = f"{det.class_name} {det.confidence:.0%}"
            text_bbox = draw.textbbox((det.x1, det.y1), label, font=font)
            draw.rectangle(
                [text_bbox[0] - 2, text_bbox[1] - 2, text_bbox[2] + 2, text_bbox[3] + 2],
                fill=color,
            )
            draw.text((det.x1, det.y1), label, fill="white", font=font)

        # Stats overlay (top-left)
        stats_lines = [
            f"PelicanEye | {len(detections)} detections | {len(clusters)} clusters",
        ]
        tiny_count = sum(1 for d in detections if (d.x2 - d.x1) * (d.y2 - d.y1) < TINY_OBJ_PIXELS)
        if tiny_count:
            stats_lines.append(f"  Tiny objects (<32px): {tiny_count}")
        overlay_text = "\n".join(stats_lines)
        tb = draw.multiline_textbbox((10, 10), overlay_text, font=font_sm)
        draw.rectangle([tb[0] - 6, tb[1] - 4, tb[2] + 6, tb[3] + 4], fill=(0, 0, 0, 160))
        draw.multiline_text((10, 10), overlay_text, fill="white", font=font_sm)

        out_path = RESULTS_DIR / f"annotated_{image_path.name}"
        img.save(out_path, quality=95)
        return out_path


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _iou(a: BoundingBox, b: BoundingBox) -> float:
    """Compute IoU between two bounding boxes."""
    x1 = max(a.x1, b.x1)
    y1 = max(a.y1, b.y1)
    x2 = min(a.x2, b.x2)
    y2 = min(a.y2, b.y2)
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area_a = (a.x2 - a.x1) * (a.y2 - a.y1)
    area_b = (b.x2 - b.x1) * (b.y2 - b.y1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


# Global service instance
detector_service = DetectorService()
