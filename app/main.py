import hashlib
import logging
import typing
import sys
from pathlib import Path

import cachetools
import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys.executable).parent
else:
    BASE_DIR = Path(__file__).resolve().parent.parent

STATIC_DIR = BASE_DIR / 'static'
TEMPLATES_DIR = BASE_DIR / 'app' / 'templates'
DEFAULT_IMAGE_FP = STATIC_DIR / 'default_image.jpg'

STATIC_DIR.mkdir(parents=True, exist_ok=True)
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

sys.path.insert(0, str(BASE_DIR))

try:
    from app import image_processing as img_proc
    from app import validators
except ImportError:
    import image_processing as img_proc
    import validators

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

if not DEFAULT_IMAGE_FP.exists():
    raise RuntimeError(f'Не предоставлено дефолтное изображение по пути "{DEFAULT_IMAGE_FP}"')

with open(DEFAULT_IMAGE_FP, 'rb') as f:
    default_image_bytes = f.read()

default_image_hash = hashlib.sha256(default_image_bytes).hexdigest()
default_image = cv2.imdecode(np.frombuffer(default_image_bytes, np.uint8), cv2.IMREAD_COLOR)

mosaic_scheme_cache = cachetools.LFUCache(maxsize=3000)

logger = logging.getLogger()
app = FastAPI()
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


def get_image_by_hash(image_hash: str) -> typing.Optional[np.ndarray]:
    if image_hash == default_image_hash:
        return default_image
    return None


def get_mosaic_scheme(img_hash: str, divider: int, n_colors: int):
    img = get_image_by_hash(img_hash)
    if img is None:
        raise HTTPException(status_code=404, detail='Изображение не найдено')

    img_height, img_width = img.shape[:2]
    grid_h = img_height // divider
    grid_w = img_width // divider
    cache_key = f"{img_hash}_{grid_h}x{grid_w}_c{n_colors}"

    if cache_key in mosaic_scheme_cache:
        return mosaic_scheme_cache[cache_key]

    scheme = img_proc.make_mosaic_scheme(
        img=img,
        grid_h=grid_h,
        grid_w=grid_w,
        n_colors=n_colors,
        divider=divider
    )
    mosaic_scheme_cache[cache_key] = scheme
    return scheme


@app.get("/")
async def get_index(request: Request):
    image_url = "/static/default_image.jpg"
    scheme = get_mosaic_scheme(default_image_hash, divider=15, n_colors=15)
    return templates.TemplateResponse(
        request,
        "image_page.html",
        {
            "image_hash": default_image_hash,
            "image_url": image_url,
            "scheme": scheme
        }
    )


@app.get('/health')
async def health():
    return {'status': 'ok'}


@app.post('/api/v1/mosaic/refresh-scheme')
async def refresh_scheme(request: validators.MosaicRefreshSchemeRequest):
    try:
        scheme = get_mosaic_scheme(request.image_hash, request.divider, request.n_colors)
        return JSONResponse(content=scheme)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(repr(e))
        raise HTTPException(status_code=500)


if __name__ == '__main__':
    uvicorn.run(
        'app.main:app' if (BASE_DIR / 'app').exists() else 'main:app',
        host='0.0.0.0',
        port=8000,
        reload=True
    )
