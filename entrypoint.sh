#!/bin/bash
set -e

echo "Загрузка дефолтного изображения..."

if [ ! -f "/app/static/default_image.jpg" ]; then
    echo "Скачиваем изображение с Яндекс.Диска..."
    mkdir -p /app/static
    
    DOWNLOAD_URL=$(curl -s "https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${DEFAULT_IMAGE_URL:-https://disk.yandex.ru/i/HuJIH0X78VrUvw}" | grep -o '"href":"[^"]*"' | cut -d '"' -f 4)
    
    if [ -n "$DOWNLOAD_URL" ]; then
        curl -L -o /app/static/default_image.jpg "$DOWNLOAD_URL"
        echo "Изображение успешно загружено"
    else
        echo "ОШИБКА: Не удалось получить ссылку для скачивания"
        exit 1
    fi
else
    echo "Изображение уже существует"
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
