import base64
import typing
import zlib
import math

import cv2
import numpy as np


def bgr_to_rgb_hex(b: int, g: int, r: int) -> str:
    return f'{r:02x}{g:02x}{b:02x}'


def calculate_grid_from_physical(
    img_shape: tuple,
    canvas_width_mm: int,
    cell_size_mm: int,
    gap_mm: int
) -> tuple[int, int, int, int]:
    """
    Рассчитывает размеры сетки на основе физических размеров.
    Возвращает: (grid_w, grid_h, divider, actual_width_mm, actual_height_mm)
    """
    img_height, img_width = img_shape[:2]
    aspect_ratio = img_width / img_height
    
    step = cell_size_mm + gap_mm
    
    if canvas_width_mm < 200:
        canvas_width_mm = 200
    
    grid_w = max(1, math.ceil(canvas_width_mm / step))
    canvas_height_mm = canvas_width_mm / aspect_ratio
    grid_h = max(1, math.ceil(canvas_height_mm / step))
    
    actual_width_mm = grid_w * cell_size_mm + (grid_w - 1) * gap_mm
    actual_height_mm = grid_h * cell_size_mm + (grid_h - 1) * gap_mm

    return grid_w, grid_h, actual_width_mm, actual_height_mm


def make_mosaic_scheme(
    img: np.ndarray,
    canvas_width_mm: int,
    cell_size_mm: int,
    gap_mm: int,
    n_colors: int,
    image_hash: str
    
) -> dict[str, typing.Any]:
    grid_w, grid_h, actual_width_mm, actual_height_mm = calculate_grid_from_physical(
        img.shape,
        canvas_width_mm,
        cell_size_mm,
        gap_mm
    )

    resized = cv2.resize(img, (grid_w, grid_h), interpolation=cv2.INTER_AREA)
    avg_colors = resized.reshape(-1, 3).astype(np.float32)
    
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
    best_labels_init = np.zeros((avg_colors.shape[0], 1), dtype=np.int32)
    
    _, labels, centers = cv2.kmeans(
        data=avg_colors,
        K=n_colors,
        bestLabels=best_labels_init,
        criteria=criteria,
        attempts=3,
        flags=cv2.KMEANS_PP_CENTERS
    )
    
    centers = centers.astype(np.uint8)
    labels = labels.flatten().astype(np.int32)
    
    masks_by_color = {}
    total_cells = grid_h * grid_w 
    for idx, label in enumerate(labels):
        color_key = tuple(centers[label].tolist())

        if color_key not in masks_by_color:
            masks_by_color[color_key] = bytearray((total_cells + 7) // 8)

        byte_idx = idx // 8
        bit_idx = idx % 8
        masks_by_color[color_key][byte_idx] |= (1 << bit_idx)

    result_clusters = []
    for color, mask_bytes in masks_by_color.items():
        count = sum(bin(byte).count('1') for byte in mask_bytes)
        
        result_clusters.append({
            "color": bgr_to_rgb_hex(*color),
            "count": count,
            "mask": base64.b64encode(zlib.compress(mask_bytes, level=9)).decode('ascii')
        })

    return {
        "image_hash": image_hash,
        "canvas_width_mm": canvas_width_mm,
        "cell_size_mm": cell_size_mm,
        "gap_mm": gap_mm,
        "n_colors": n_colors,
        "grid": {"width": grid_w, "height": grid_h},
        "actual_size": {
            "width_mm": actual_width_mm,
            "height_mm": actual_height_mm
        },
        "area_m2": round((actual_width_mm * actual_height_mm) / 1000000, 3),
        "total_cells": total_cells,
        "clusters": result_clusters
    }
