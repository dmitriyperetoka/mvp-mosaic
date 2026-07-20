import base64
import json
import zlib

import cv2
import numpy as np


def bgr_to_rgb__hex(b: int, g: int, r: int) -> str:
    return f'{r:02x}{g:02x}{b:02x}'


def img_to_mosaic_scheme(
    img: np.ndarray,
    grid_h: int,
    grid_w: int,
    n_colors: int
) -> str:
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
            "color": bgr_to_rgb__hex(*color),
            "count": count,
            "mask": base64.b64encode(zlib.compress(mask_bytes, level=9)).decode('ascii')
        })
    
    result = {
        "grid": {"width": grid_w, "height": grid_h},
        "clusters": result_clusters
    }

    return json.dumps(result, separators=(',', ':'))