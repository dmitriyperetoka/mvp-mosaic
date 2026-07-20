
class MosaicApp {
    constructor(initialData) {
        // Данные
        this.imageHash = initialData.imageHash;
        this.imageUrl = initialData.imageUrl;
        this.scheme = initialData.scheme;
        
        // Состояние
        this.isLoading = false;
        this.divider = 10;
        this.nColors = 16;
        this.timers = {};
        
        // DOM-элементы
        this.originalImg = document.getElementById('originalImage');
        this.canvas = document.getElementById('mosaicCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.mosaicStatus = document.getElementById('mosaicStatus');
        this.colorPalette = document.getElementById('colorPalette');
        
        // Элементы управления
        this.dividerSlider = document.getElementById('dividerSlider');
        this.dividerInput = document.getElementById('dividerInput');
        this.colorsSlider = document.getElementById('colorsSlider');
        this.colorsInput = document.getElementById('colorsInput');
        
        // Инициализация
        this.init();
    }

    init() {
        this.originalImg.src = this.imageUrl;
        
        this.divider = parseInt(this.dividerSlider.value) || 10;
        this.nColors = parseInt(this.colorsSlider.value) || 16;
        
        this.dividerSlider.value = this.divider;
        this.dividerInput.value = this.divider;
        this.colorsSlider.value = this.nColors;
        this.colorsInput.value = this.nColors;
        
        this.drawMosaic(this.scheme);
        this.renderPalette(this.scheme);
        this.bindEvents();
    }

    bindEvents() {
        // ===== Divider слайдер =====
        this.dividerSlider.addEventListener('input', () => {
            const value = parseInt(this.dividerSlider.value);
            this.dividerInput.value = value;
        });
        
        this.dividerSlider.addEventListener('change', () => {
            const value = parseInt(this.dividerSlider.value);
            this.dividerInput.value = value;
            this.triggerRefresh(value, this.nColors);
        });

        // ===== Divider поле ввода =====
        this.dividerInput.addEventListener('input', () => {
            const value = parseInt(this.dividerInput.value);
            if (!isNaN(value) && value >= 2 && value <= 50) {
                this.dividerSlider.value = value;
                clearTimeout(this.timers.divider);
                this.timers.divider = setTimeout(() => {
                    this.triggerRefresh(value, this.nColors);
                }, 1000);
            }
        });
        
        this.dividerInput.addEventListener('blur', () => {
            const rawValue = parseInt(this.dividerInput.value);
            let value = rawValue;
            
            if (isNaN(rawValue)) {
                this.dividerInput.value = this.divider;
                this.dividerSlider.value = this.divider;
                return;
            }
            
            if (value < 2) value = 2;
            if (value > 50) value = 50;
            
            this.dividerInput.value = value;
            this.dividerSlider.value = value;
            
            if (value !== this.divider) {
                clearTimeout(this.timers.divider);
                this.triggerRefresh(value, this.nColors);
            }
        });
        
        this.dividerInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.dividerInput.blur();
            }
        });

        // ===== Colors слайдер =====
        this.colorsSlider.addEventListener('input', () => {
            const value = parseInt(this.colorsSlider.value);
            this.colorsInput.value = value;
        });
        
        this.colorsSlider.addEventListener('change', () => {
            const value = parseInt(this.colorsSlider.value);
            this.colorsInput.value = value;
            this.triggerRefresh(this.divider, value);
        });

        // ===== Colors поле ввода =====
        this.colorsInput.addEventListener('input', () => {
            const value = parseInt(this.colorsInput.value);
            if (!isNaN(value) && value >= 2 && value <= 50) {
                this.colorsSlider.value = value;
                clearTimeout(this.timers.colors);
                this.timers.colors = setTimeout(() => {
                    this.triggerRefresh(this.divider, value);
                }, 1000);
            }
        });
        
        this.colorsInput.addEventListener('blur', () => {
            const rawValue = parseInt(this.colorsInput.value);
            let value = rawValue;
            
            if (isNaN(rawValue)) {
                this.colorsInput.value = this.nColors;
                this.colorsSlider.value = this.nColors;
                return;
            }
            
            if (value < 2) value = 2;
            if (value > 50) value = 50;
            
            this.colorsInput.value = value;
            this.colorsSlider.value = value;
            
            if (value !== this.nColors) {
                clearTimeout(this.timers.colors);
                this.triggerRefresh(this.divider, value);
            }
        });
        
        this.colorsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.colorsInput.blur();
            }
        });

        // ===== Кнопка сброса настроек =====
        this.resetBtn = document.getElementById('resetSettingsBtn');
        this.resetBtn.addEventListener('click', () => {
            this.resetToDefaults();
        });
    }

    resetToDefaults() {
        const defaultDivider = 15;
        const defaultColors = 15;
        
        if (this.divider === defaultDivider && this.nColors === defaultColors) {
            return;
        }
        
        this.dividerSlider.value = defaultDivider;
        this.dividerInput.value = defaultDivider;
        this.colorsSlider.value = defaultColors;
        this.colorsInput.value = defaultColors;

        this.triggerRefresh(defaultDivider, defaultColors);
    }

    triggerRefresh(divider, nColors) {
        if (divider === this.divider && nColors === this.nColors) {
            return;
        }

        const oldDivider = this.divider;
        const oldNColors = this.nColors;
        
        this.divider = divider;
        this.nColors = nColors;
        
        // Обновляем UI сразу (оптимистично)
        this.dividerSlider.value = divider;
        this.dividerInput.value = divider;
        this.colorsSlider.value = nColors;
        this.colorsInput.value = nColors;
        
        this.refreshScheme(divider, nColors).catch(() => {
            // Откат при ошибке
            this.divider = oldDivider;
            this.nColors = oldNColors;
            this.dividerSlider.value = oldDivider;
            this.dividerInput.value = oldDivider;
            this.colorsSlider.value = oldNColors;
            this.colorsInput.value = oldNColors;
        });
    }

    async refreshScheme(divider, nColors) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.setLoadingState(true);
        
        try {
            const payload = {
                image_hash: this.imageHash,
                divider: divider,
                n_colors: nColors
            };
            
            const response = await fetch('/api/v1/mosaic/refresh-scheme', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Ошибка сервера');
            }
            
            const newScheme = await response.json();
            
            // Обновляем схему
            this.scheme = newScheme;
            
            // Обновляем UI (значения уже обновлены в triggerRefresh)
            this.dividerSlider.value = this.divider;
            this.dividerInput.value = this.divider;
            this.colorsSlider.value = this.nColors;
            this.colorsInput.value = this.nColors;
            
            // Перерисовываем
            this.drawMosaic(newScheme);
            this.renderPalette(newScheme);
            
            this.mosaicStatus.textContent = 'Обновлено';
            this.mosaicStatus.className = 'badge bg-success';
            
        } catch (error) {
            console.error('Ошибка обновления схемы:', error);
            this.mosaicStatus.textContent = 'Ошибка';
            this.mosaicStatus.className = 'badge bg-danger';
            throw error; // ← пробрасываем для catch в triggerRefresh
        } finally {
            this.isLoading = false;
            this.setLoadingState(false);
        }
    }

    validateAndRefresh(type) {
        let input;
        let currentValue;
        
        if (type === 'divider') {
            input = this.dividerInput;
            currentValue = this.divider;
        } else {
            input = this.colorsInput;
            currentValue = this.nColors;
        }
        
        const value = parseInt(input.value);
        
        if (isNaN(value) || value < 2 || value > 50) {
            input.value = currentValue;
            if (type === 'divider') {
                this.dividerSlider.value = currentValue;
            } else {
                this.colorsSlider.value = currentValue;
            }
            return;
        }
        
        if (type === 'divider') {
            this.dividerSlider.value = value;
            this.divider = value;
        } else {
            this.colorsSlider.value = value;
            this.nColors = value;
        }
        
        this.triggerRefresh(this.divider, this.nColors);
    }


    drawMosaic(scheme) {
        const divider = this.divider;
        const grid = scheme.grid;
        const gridWidth = grid.width;
        const gridHeight = grid.height;
        
        if (!gridWidth || !gridHeight || !divider) {
            console.error('Невалидные размеры сетки:', { gridWidth, gridHeight, divider });
            return;
        }
        
        const canvasWidth = Math.floor(gridWidth * divider);
        const canvasHeight = Math.floor(gridHeight * divider);
        
        if (canvasWidth <= 0 || canvasHeight <= 0) {
            console.error('Размеры канваса должны быть > 0:', { canvasWidth, canvasHeight });
            return;
        }
        
        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        
        const imageData = this.ctx.createImageData(canvasWidth, canvasHeight);
        const data = imageData.data;
        
        // Белый фон
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
            data[i + 3] = 255;
        }
        
        const totalCells = gridWidth * gridHeight;
        
        for (const cluster of scheme.clusters) {
            const colorHex = cluster.color;
            const rgb = this.hexToRgb(colorHex);
            const maskBase64 = cluster.mask;
            
            // Декодируем маску
            const maskBytes = this.decodeMask(maskBase64);
            
            // Проверяем размер маски
            const expectedBytes = Math.floor((totalCells + 7) / 8);
            if (maskBytes.length !== expectedBytes) {
                console.warn(`Размер маски не совпадает: ожидается ${expectedBytes}, получено ${maskBytes.length}`);
            }
            
            let cellIndex = 0;
            for (let byteIdx = 0; byteIdx < maskBytes.length; byteIdx++) {
                const byte = maskBytes[byteIdx];
                for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
                    if (cellIndex >= totalCells) break;
                    
                    if (byte & (1 << bitIdx)) {
                        const y = Math.floor(cellIndex / gridWidth);
                        const x = cellIndex % gridWidth;
                        
                        const startX = x * divider;
                        const startY = y * divider;
                        
                        for (let dy = 0; dy < divider; dy++) {
                            for (let dx = 0; dx < divider; dx++) {
                                const px = startX + dx;
                                const py = startY + dy;
                                const idx = (py * canvasWidth + px) * 4;
                                data[idx] = rgb[0];
                                data[idx + 1] = rgb[1];
                                data[idx + 2] = rgb[2];
                                data[idx + 3] = 255;
                            }
                        }
                    }
                    cellIndex++;
                }
            }
        }
        
        this.ctx.putImageData(imageData, 0, 0);
    }

    decodeMask(base64Str) {
        // 1. Декодируем Base64 в бинарные данные
        const binary = atob(base64Str);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        
        // 2. Распаковываем ZLIB (первый байт 0x78 — признак ZLIB)
        if (bytes.length > 0 && bytes[0] === 0x78) {
            try {
                if (typeof pako !== 'undefined') {
                    const decompressed = pako.inflate(bytes);
                    return decompressed;
                } else {
                    console.warn('pako не подключён, данные не распакованы');
                    return bytes;
                }
            } catch (e) {
                console.error('Ошибка распаковки ZLIB:', e);
                return bytes;
            }
        }

        return bytes;
    }

    renderPalette(scheme) {
        const clusters = scheme.clusters;
        
        this.colorPalette.innerHTML = '';
        
        // Сортируем по убыванию количества
        const sortedClusters = [...clusters].sort((a, b) => b.count - a.count);
        
        for (const cluster of sortedClusters) {
            const colorHex = cluster.color;
            const count = cluster.count;
            
            // Создаём элемент
            const item = document.createElement('div');
            item.className = 'color-palette-item';
            
            // Прямоугольник цвета
            const colorBox = document.createElement('div');
            colorBox.className = 'color-box';
            colorBox.style.backgroundColor = `#${colorHex}`;
            
            // Контейнер для текста (две строки)
            const infoContainer = document.createElement('div');
            infoContainer.className = 'color-info';
            
            // Строка 1: Цвет: #123ABC
            const hexLabel = document.createElement('div');
            hexLabel.className = 'color-hex';
            hexLabel.textContent = `Цвет: #${colorHex}`;
            
            // Строка 2: Количество: 123
            const countLabel = document.createElement('div');
            countLabel.className = 'color-count';
            countLabel.textContent = `Количество: ${count}`;
            
            // Собираем
            infoContainer.appendChild(hexLabel);
            infoContainer.appendChild(countLabel);
            
            item.appendChild(colorBox);
            item.appendChild(infoContainer);
            
            this.colorPalette.appendChild(item);
        }
    }

    hexToRgb(hex) {
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        return [
            parseInt(hex.substring(0, 2), 16),
            parseInt(hex.substring(2, 4), 16),
            parseInt(hex.substring(4, 6), 16)
        ];
    }

    setLoadingState(loading) {
        if (loading) {
            this.loadingOverlay.classList.remove('d-none');
            this.loadingOverlay.classList.add('d-flex');
            this.dividerSlider.disabled = true;
            this.dividerInput.disabled = true;
            this.colorsSlider.disabled = true;
            this.colorsInput.disabled = true;
            this.mosaicStatus.textContent = 'Загрузка...';
            this.mosaicStatus.className = 'badge bg-warning text-dark';
        } else {
            this.loadingOverlay.classList.add('d-none');
            this.loadingOverlay.classList.remove('d-flex');
            this.dividerSlider.disabled = false;
            this.dividerInput.disabled = false;
            this.colorsSlider.disabled = false;
            this.colorsInput.disabled = false;
        }
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    if (window.__initialData) {
        window.app = new MosaicApp(window.__initialData);
    } else {
        console.error('Нет начальных данных!');
    }
});
