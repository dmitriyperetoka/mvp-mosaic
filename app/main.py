import hashlib
import logging
import typing
import sys
from pathlib import Path

import cachetools
import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys.executable).parent
else:
    BASE_DIR = Path(__file__).resolve().parent.parent

STATIC_DIR = BASE_DIR / 'static'
UPLOADS_DIR = BASE_DIR / 'uploads'
TEMPLATES_DIR = BASE_DIR / 'app' / 'templates'
DEFAULT_IMAGE_FP = STATIC_DIR / 'default_image.jpg'

STATIC_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
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
image_cache = {}  # {hash: numpy_array}

logger = logging.getLogger()
app = FastAPI()

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


def get_image_by_hash(image_hash: str) -> typing.Optional[np.ndarray]:
    if image_hash == default_image_hash:
        return default_image

    if image_hash in image_cache:
        return image_cache[image_hash]

    return None


def store_image(image_bytes: bytes) -> str:
    """Сохраняет изображение в кэш и на диск, возвращает хэш"""
    image_hash = hashlib.sha256(image_bytes).hexdigest()

    if image_hash in image_cache:
        logger.info(f"Изображение {image_hash[:8]}... уже в кэше")
        return image_hash

    img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        logger.error("OpenCV не может декодировать изображение")
        raise HTTPException(status_code=400, detail="Невалидное изображение")

    logger.info(f"Изображение декодировано: shape={img.shape}")

    image_cache[image_hash] = img

    upload_path = UPLOADS_DIR / f"{image_hash}.jpg"
    success = cv2.imwrite(str(upload_path), img, [cv2.IMWRITE_JPEG_QUALITY, 95])
    
    if not success:
        logger.error(f"Не удалось сохранить изображение на диск: {upload_path}")
        raise HTTPException(status_code=500, detail="Ошибка сохранения изображения")

    logger.info(f"Изображение сохранено на диск: {upload_path}")

    return image_hash


def get_mosaic_scheme(
    img_hash: str,
    canvas_width_mm: int,
    cell_size_mm: int,
    gap_mm: int,
    n_colors: int
):
    img = get_image_by_hash(img_hash)
    if img is None:
        raise HTTPException(status_code=404, detail='Изображение не найдено')

    cache_key = f"{img_hash}_cw{canvas_width_mm}_c{cell_size_mm}_g{gap_mm}_n{n_colors}"

    if cache_key in mosaic_scheme_cache:
        return mosaic_scheme_cache[cache_key]

    scheme = img_proc.make_mosaic_scheme(
        img=img,
        canvas_width_mm=canvas_width_mm,
        cell_size_mm=cell_size_mm,
        gap_mm=gap_mm,
        n_colors=n_colors,
        image_hash=img_hash
    )
    mosaic_scheme_cache[cache_key] = scheme

    return scheme


@app.get("/")
async def get_index(request: Request):
    scheme = get_mosaic_scheme(
        default_image_hash,
        canvas_width_mm=1000,
        cell_size_mm=15,
        gap_mm=2,
        n_colors=15
    )
    return templates.TemplateResponse(
        request,
        "image_page.html",
        {
            "default_image_url": "/static/default_image.jpg",
            "scheme": scheme
        }
    )


@app.get('/health')
async def health():
    return {'status': 'ok'}


@app.post('/api/v1/mosaic/refresh-scheme')
async def refresh_scheme(request: validators.MosaicRefreshSchemeRequest):
    try:
        scheme = get_mosaic_scheme(
            request.image_hash,
            request.canvas_width_mm,
            request.cell_size_mm,
            request.gap_mm,
            request.n_colors
        )
        return JSONResponse(content=scheme)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(repr(e))
        raise HTTPException(status_code=500)


@app.post('/api/v1/upload-image')
async def upload_image(
    file: UploadFile = File(...),
    canvas_width_mm: int = Form(1000),
    cell_size_mm: int = Form(15),
    gap_mm: int = Form(2),
    n_colors: int = Form(15)
):
    if file.content_type is None or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Файл должен быть изображением")

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс. 20MB)")

    try:
        image_hash = store_image(content)
        
        scheme = get_mosaic_scheme(
            image_hash,
            canvas_width_mm,
            cell_size_mm,
            gap_mm,
            n_colors
        )
        
        return JSONResponse(content={
            "image_url": f"/uploads/{image_hash}.jpg",
            "scheme": scheme
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка загрузки: {repr(e)}")
        raise HTTPException(status_code=500, detail="Ошибка обработки изображения")


@app.post('/api/v1/reset-to-default-image')
async def reset_to_default(
    canvas_width_mm: int = Form(1000),
    cell_size_mm: int = Form(15),
    gap_mm: int = Form(2),
    n_colors: int = Form(15)
):
    """Сброс к дефолтному изображению с текущими настройками"""
    try:
        scheme = get_mosaic_scheme(
            default_image_hash,
            canvas_width_mm,
            cell_size_mm,
            gap_mm,
            n_colors
        )

        return JSONResponse(content={
            "image_url": "/static/default_image.jpg",
            "scheme": scheme
        })

    except Exception as e:
        logger.error(f"Ошибка сброса: {repr(e)}")
        raise HTTPException(status_code=500, detail="Ошибка сброса к дефолтному изображению")


if __name__ == '__main__':
    uvicorn.run(
        'app.main:app' if (BASE_DIR / 'app').exists() else 'main:app',
        host='0.0.0.0',
        port=8000,
        reload=True
    )
