import hashlib
import json
import logging
import os
import typing

import cachetools
import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

import image_processing as img_proc
import validators

DEFAULT_IMAGE_FP = 'media/default_image.jpg'

if not os.path.exists(DEFAULT_IMAGE_FP):
    raise RuntimeError(f'Не предоставлено дефолтное изображение по пути "{DEFAULT_IMAGE_FP}"')

with open(DEFAULT_IMAGE_FP, 'rb') as f:
    default_image_bytes = f.read()

default_image_hash = hashlib.sha256(default_image_bytes).hexdigest()
default_image = cv2.imdecode(np.frombuffer(default_image_bytes, np.uint8), cv2.IMREAD_COLOR)

mosaic_scheme_cache = cachetools.LFUCache(maxsize=3000)

logger = logging.getLogger()
app = FastAPI()


def get_image_by_hash(image_hash: str) -> typing.Optional[np.ndarray]:
    if image_hash == default_image_hash:
        return default_image
    return None

@app.get('/health')
async def health():
    return {'status': 'ok'}


@app.post('/api/v1/mosaic/refresh-scheme')
async def refresh_scheme(request: validators.MosaicRefreshSchemeRequest):
    img_hash = request.img_hash
    divider = request.divider
    n_colors = request.n_colors

    img = get_image_by_hash(img_hash)
    if img is None:
        raise HTTPException(status_code=404, detail='Изображение не найдено')
 
    try:
        img_height, img_width = img.shape[:2]
        grid_h = img_height // divider
        grid_w = img_width // divider
        cache_key = f"{img_hash}_{grid_h}x{grid_w}_c{n_colors}"

        if cache_key in mosaic_scheme_cache:
            result_json = mosaic_scheme_cache[cache_key]
        else:
            result_json = img_proc.img_to_mosaic_scheme(
                img=img,
                grid_h=grid_h,
                grid_w=grid_w,
                n_colors=request.n_colors
            )
            mosaic_scheme_cache[cache_key] = result_json
        return JSONResponse(content=json.loads(result_json))
    except Exception as e:
        logger.error(repr(e))
        raise HTTPException(status_code=500)


if __name__ == '__main__':
    uvicorn.run(
        'main:app',
        host='0.0.0.0',
        port=8000,
        reload=True
    )
