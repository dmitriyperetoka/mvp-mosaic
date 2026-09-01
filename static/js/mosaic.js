
class MosaicApp {
    constructor(initialData) {
        this.defaultImageHash = initialData.defaultImageHash;
        this.defaultImageUrl = initialData.defaultImageUrl;
        this.currentImageHash = initialData.scheme.image_hash;
        this.currentImageUrl = initialData.defaultImageUrl;
        this.scheme = initialData.scheme;
        
        this.isLoading = false;
        this.canvasWidthMm = 1000;
        this.cellSizeMm = 15;
        this.gapMm = 2;
        this.nColors = 15;
        this.timers = {};
        this.isDnDActive = false;

        this.originalImg = document.getElementById('originalImage');
        this.canvas = document.getElementById('mosaicCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.imageLoadingOverlay = document.getElementById('imageLoadingOverlay');
        this.mosaicLoadingOverlay = document.getElementById('mosaicLoadingOverlay');
        this.mosaicStatus = document.getElementById('mosaicStatus');
        this.colorPalette = document.getElementById('colorPalette');
        this.dropZone = document.getElementById('dropZone');
        this.dropOverlay = document.getElementById('dropOverlay');
        
        this.canvasWidthSlider = document.getElementById('canvasWidthSlider');
        this.canvasWidthInput = document.getElementById('canvasWidthInput');
        this.cellSizeSlider = document.getElementById('cellSizeSlider');
        this.cellSizeInput = document.getElementById('cellSizeInput');
        this.gapSlider = document.getElementById('gapSlider');
        this.gapInput = document.getElementById('gapInput');
        this.colorsSlider = document.getElementById('colorsSlider');
        this.colorsInput = document.getElementById('colorsInput');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.fileInput = document.getElementById('fileInput');
        this.resetBtn = document.getElementById('resetSettingsBtn');
        this.resetImageBtn = document.getElementById('resetImageBtn');
        
        this.summaryCanvasWidth = document.getElementById('summaryCanvasWidth');
        this.summaryCanvasHeight = document.getElementById('summaryCanvasHeight');
        this.summaryCellSize = document.getElementById('summaryCellSize');
        this.summaryTotalCells = document.getElementById('summaryTotalCells');
        this.summaryGap = document.getElementById('summaryGap');
        this.summaryColors = document.getElementById('summaryColors');
        
        this.init();
    }

    init() {
        this.originalImg.src = this.currentImageUrl;

        this.canvasWidthSlider.value = this.scheme.actual_size.width_mm
        this.canvasWidthInput.value = this.scheme.actual_size.width_mm
        this.canvasWidthMm = this.scheme.actual_size.width_mm;
        this.cellSizeMm = this.scheme.cell_size_mm;
        this.gapMm = this.scheme.gap_mm;
        this.nColors = this.scheme.n_colors;

        this.drawMosaic(this.scheme);
        this.renderPalette(this.scheme);
        this.updateSummary(this.scheme);
        this.bindEvents();
    }

    bindEvents() {
        this.canvasWidthSlider.addEventListener('input', () => {
            const value = parseInt(this.canvasWidthSlider.value);
            this.canvasWidthInput.value = value;
        });
        
        this.canvasWidthSlider.addEventListener('change', () => {
            const value = parseInt(this.canvasWidthSlider.value);
            this.canvasWidthInput.value = value;
            this.triggerRefresh(value, this.cellSizeMm, this.gapMm, this.nColors);
        });

        this.canvasWidthInput.addEventListener('input', () => {
            const value = parseInt(this.canvasWidthInput.value);
            if (!isNaN(value) && value >= 200 && value <= 5000) {
                this.canvasWidthSlider.value = value;
                clearTimeout(this.timers.canvasWidth);
                this.timers.canvasWidth = setTimeout(() => {
                    this.triggerRefresh(value, this.cellSizeMm, this.gapMm, this.nColors);
                }, 1000);
            }
        });
        
        this.canvasWidthInput.addEventListener('blur', () => {
            const rawValue = parseInt(this.canvasWidthInput.value);
            let value = rawValue;
            
            if (isNaN(rawValue)) {
                this.canvasWidthInput.value = this.canvasWidthMm;
                this.canvasWidthSlider.value = this.canvasWidthMm;
                return;
            }
            
            if (value < 200) value = 200;
            if (value > 5000) value = 5000;
            
            this.canvasWidthInput.value = value;
            this.canvasWidthSlider.value = value;
            
            if (value !== this.canvasWidthMm) {
                clearTimeout(this.timers.canvasWidth);
                this.triggerRefresh(value, this.cellSizeMm, this.gapMm, this.nColors);
            }
        });

        this.canvasWidthInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.canvasWidthInput.blur();
            }
        });

        this.cellSizeSlider.addEventListener('input', () => {
            const value = parseInt(this.cellSizeSlider.value);
            this.cellSizeInput.value = value;
        });
        
        this.cellSizeSlider.addEventListener('change', () => {
            const value = parseInt(this.cellSizeSlider.value);
            this.cellSizeInput.value = value;
            this.syncCanvasWidth(this.canvasWidthMm);
            this.triggerRefresh(this.canvasWidthMm, value, this.gapMm, this.nColors);
        });

        this.cellSizeInput.addEventListener('input', () => {
            const value = parseInt(this.cellSizeInput.value);
            if (!isNaN(value) && value >= 5 && value <= 50) {
                this.cellSizeSlider.value = value;
                clearTimeout(this.timers.cellSize);
                this.timers.cellSize = setTimeout(() => {
                    this.syncCanvasWidth(this.canvasWidthMm);
                    this.triggerRefresh(this.canvasWidthMm, value, this.gapMm, this.nColors);
                }, 1000);
            }
        });
        
        this.cellSizeInput.addEventListener('blur', () => {
            const rawValue = parseInt(this.cellSizeInput.value);
            let value = rawValue;
            
            if (isNaN(rawValue)) {
                this.cellSizeInput.value = this.cellSizeMm;
                this.cellSizeSlider.value = this.cellSizeMm;
                return;
            }
            
            if (value < 5) value = 5;
            if (value > 50) value = 50;
            
            this.cellSizeInput.value = value;
            this.cellSizeSlider.value = value;
            
            if (value !== this.cellSizeMm) {
                clearTimeout(this.timers.cellSize);
                this.syncCanvasWidth(this.canvasWidthMm);
                this.triggerRefresh(this.canvasWidthMm, value, this.gapMm, this.nColors);
            }
        });

        this.cellSizeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.cellSizeInput.blur();
            }
        });

        this.gapSlider.addEventListener('input', () => {
            const value = parseInt(this.gapSlider.value);
            this.gapInput.value = value;
        });
        
        this.gapSlider.addEventListener('change', () => {
            const value = parseInt(this.gapSlider.value);
            this.gapInput.value = value;
            this.syncCanvasWidth(this.canvasWidthMm);
            this.triggerRefresh(this.canvasWidthMm, this.cellSizeMm, value, this.nColors);
        });

        this.gapInput.addEventListener('input', () => {
            const value = parseInt(this.gapInput.value);
            if (!isNaN(value) && value >= 0 && value <= 10) {
                this.gapSlider.value = value;
                clearTimeout(this.timers.gap);
                this.timers.gap = setTimeout(() => {
                    this.syncCanvasWidth(this.canvasWidthMm);
                    this.triggerRefresh(this.canvasWidthMm, this.cellSizeMm, value, this.nColors);
                }, 1000);
            }
        });
        
        this.gapInput.addEventListener('blur', () => {
            const rawValue = parseInt(this.gapInput.value);
            let value = rawValue;
            
            if (isNaN(rawValue)) {
                this.gapInput.value = this.gapMm;
                this.gapSlider.value = this.gapMm;
                return;
            }
            
            if (value < 0) value = 0;
            if (value > 10) value = 10;
            
            this.gapInput.value = value;
            this.gapSlider.value = value;
            
            if (value !== this.gapMm) {
                clearTimeout(this.timers.gap);
                this.syncCanvasWidth(this.canvasWidthMm);
                this.triggerRefresh(this.canvasWidthMm, this.cellSizeMm, value, this.nColors);
            }
        });

        this.gapInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.gapInput.blur();
            }
        });

        this.colorsSlider.addEventListener('input', () => {
            const value = parseInt(this.colorsSlider.value);
            this.colorsInput.value = value;
        });
        
        this.colorsSlider.addEventListener('change', () => {
            const value = parseInt(this.colorsSlider.value);
            this.colorsInput.value = value;
            this.triggerRefresh(this.canvasWidthMm, this.cellSizeMm, this.gapMm, value);
        });

        this.colorsInput.addEventListener('input', () => {
            const value = parseInt(this.colorsInput.value);
            if (!isNaN(value) && value >= 2 && value <= 50) {
                this.colorsSlider.value = value;
                clearTimeout(this.timers.colors);
                this.timers.colors = setTimeout(() => {
                    this.triggerRefresh(this.canvasWidthMm, this.cellSizeMm, this.gapMm, value);
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
                this.triggerRefresh(this.canvasWidthMm, this.cellSizeMm, this.gapMm, value);
            }
        });

        this.colorsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.colorsInput.blur();
            }
        });

        this.resetBtn.addEventListener('click', () => {
            this.resetToDefaults();
        });

        this.resetImageBtn.addEventListener('click', () => {
            this.resetToDefaultImage();
        });

        this.uploadBtn.addEventListener('click', () => {
            this.fileInput.click();
        });

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0]);
            }
            this.fileInput.value = '';
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        
        document.addEventListener('drop', (e) => {
            e.preventDefault();
        });

        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this.isDnDActive) {
                this.isDnDActive = true;
                this.dropOverlay.classList.remove('d-none');
                this.dropOverlay.classList.add('d-flex');
            }
        });

        this.dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const relatedTarget = e.relatedTarget;
            if (!this.dropZone.contains(relatedTarget)) {
                this.isDnDActive = false;
                this.dropOverlay.classList.add('d-none');
                this.dropOverlay.classList.remove('d-flex');
            }
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.isDnDActive = false;
            this.dropOverlay.classList.add('d-none');
            this.dropOverlay.classList.remove('d-flex');
            
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                this.handleFileUpload(files[0]);
            } else if (files.length > 0) {
                alert('Пожалуйста, загрузите изображение');
            }
        });
    }

    syncCanvasWidth(currentWidth) {
        const step = this.cellSizeMm + this.gapMm;
        let newValue = Math.ceil(currentWidth / step) * step - this.gapMm;
        if (newValue < 200) newValue = 200;
        if (newValue > 5000) newValue = 5000;
        
        this.canvasWidthMm = newValue;
        this.canvasWidthSlider.value = newValue;
        this.canvasWidthInput.value = newValue;
    }

    resetToDefaults() {
        const defaultCanvasWidth = 1001;
        const defaultCellSize = 15;
        const defaultGap = 2;
        const defaultColors = 15;
        
        if (this.canvasWidthMm === defaultCanvasWidth && 
            this.cellSizeMm === defaultCellSize && 
            this.gapMm === defaultGap && 
            this.nColors === defaultColors) {
            return;
        }
        
        this.canvasWidthSlider.value = defaultCanvasWidth;
        this.canvasWidthInput.value = defaultCanvasWidth;
        this.cellSizeSlider.value = defaultCellSize;
        this.cellSizeInput.value = defaultCellSize;
        this.gapSlider.value = defaultGap;
        this.gapInput.value = defaultGap;
        this.colorsSlider.value = defaultColors;
        this.colorsInput.value = defaultColors;

        this.triggerRefresh(defaultCanvasWidth, defaultCellSize, defaultGap, defaultColors);
    }

    triggerRefresh(canvasWidth, cellSize, gap, nColors) {
        if (canvasWidth === this.canvasWidthMm && 
            cellSize === this.cellSizeMm && 
            gap === this.gapMm && 
            nColors === this.nColors) {
            return;
        }

        const oldCanvasWidth = this.canvasWidthMm;
        const oldCellSize = this.cellSizeMm;
        const oldGap = this.gapMm;
        const oldNColors = this.nColors;
        
        this.canvasWidthMm = canvasWidth;
        this.cellSizeMm = cellSize;
        this.gapMm = gap;
        this.nColors = nColors;
        
        this.canvasWidthSlider.value = canvasWidth;
        this.canvasWidthInput.value = canvasWidth;
        this.cellSizeSlider.value = cellSize;
        this.cellSizeInput.value = cellSize;
        this.gapSlider.value = gap;
        this.gapInput.value = gap;
        this.colorsSlider.value = nColors;
        this.colorsInput.value = nColors;
        
        this.refreshScheme(canvasWidth, cellSize, gap, nColors).catch(() => {
            this.canvasWidthMm = oldCanvasWidth;
            this.cellSizeMm = oldCellSize;
            this.gapMm = oldGap;
            this.nColors = oldNColors;
            this.canvasWidthSlider.value = oldCanvasWidth;
            this.canvasWidthInput.value = oldCanvasWidth;
            this.cellSizeSlider.value = oldCellSize;
            this.cellSizeInput.value = oldCellSize;
            this.gapSlider.value = oldGap;
            this.gapInput.value = oldGap;
            this.colorsSlider.value = oldNColors;
            this.colorsInput.value = oldNColors;
        });
    }

    async refreshScheme(canvasWidth, cellSize, gap, nColors) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.setLoadingState(true);
        
        try {
            const payload = {
                image_hash: this.currentImageHash,
                canvas_width_mm: canvasWidth,
                cell_size_mm: cellSize,
                gap_mm: gap,
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
            
            this.scheme = newScheme;
            
            // Синхронизируем ширину полотна с фактическим значением
            this.syncCanvasWidth(newScheme.actual_size.width_mm);
            
            this.drawMosaic(newScheme);
            this.renderPalette(newScheme);
            this.updateSummary(newScheme);
            
            this.mosaicStatus.textContent = 'Обновлено';
            this.mosaicStatus.className = 'badge bg-success';
            
        } catch (error) {
            console.error('Ошибка обновления схемы:', error);
            this.mosaicStatus.textContent = 'Ошибка';
            this.mosaicStatus.className = 'badge bg-danger';
            throw error;
        } finally {
            this.isLoading = false;
            this.setLoadingState(false);
        }
    }

    async resetToDefaultImage() {
        if (this.currentImageHash === this.defaultImageHash) {
            return;
        }

        this.setLoadingState(true);
        this.mosaicStatus.textContent = 'Сброс...';
        this.mosaicStatus.className = 'badge bg-warning text-dark';

        try {
            const formData = new FormData();
            formData.append('canvas_width_mm', this.canvasWidthMm);
            formData.append('cell_size_mm', this.cellSizeMm);
            formData.append('gap_mm', this.gapMm);
            formData.append('n_colors', this.nColors);

            const response = await fetch('/api/v1/reset-to-default-image', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Ошибка сброса');
            }

            const data = await response.json();

            this.currentImageHash = this.defaultImageHash;
            this.currentImageUrl = data.image_url;
            this.scheme = data.scheme;

            await this.loadImage(this.currentImageUrl);

            this.drawMosaic(this.scheme);
            this.renderPalette(this.scheme);
            this.updateSummary(this.scheme);
            
            this.mosaicStatus.textContent = 'Готово';
            this.mosaicStatus.className = 'badge bg-success';
            
        } catch (error) {
            console.error('Ошибка сброса:', error);
            this.mosaicStatus.textContent = 'Ошибка';
            this.mosaicStatus.className = 'badge bg-danger';
            alert(error.message || 'Ошибка сброса к дефолтному изображению');
        } finally {
            this.setLoadingState(false);
        }
    }

    async handleFileUpload(file) {
        if (!file.type.startsWith('image/')) {
            alert('Пожалуйста, загрузите изображение');
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            alert('Файл слишком большой (макс. 20MB)');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('canvas_width_mm', this.canvasWidthMm);
        formData.append('cell_size_mm', this.cellSizeMm);
        formData.append('gap_mm', this.gapMm);
        formData.append('n_colors', this.nColors);

        this.setLoadingState(true);
        this.mosaicStatus.textContent = 'Загрузка...';
        this.mosaicStatus.className = 'badge bg-warning text-dark';

        try {
            const response = await fetch('/api/v1/upload-image', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Ошибка загрузки');
            }

            const data = await response.json();
            
            this.currentImageHash = data.scheme.image_hash;
            this.currentImageUrl = data.image_url;
            this.scheme = data.scheme;
            
            await this.loadImage(this.currentImageUrl);
            
            this.drawMosaic(this.scheme);
            this.renderPalette(this.scheme);
            this.updateSummary(this.scheme);
            
            this.mosaicStatus.textContent = 'Готово';
            this.mosaicStatus.className = 'badge bg-success';
            
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            this.mosaicStatus.textContent = 'Ошибка';
            this.mosaicStatus.className = 'badge bg-danger';
            alert(error.message || 'Ошибка загрузки изображения');
        } finally {
            this.setLoadingState(false);
        }
    }

    loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                this.originalImg.src = url;
                resolve();
            };
            
            img.onerror = () => {
                this.originalImg.src = url;
                reject(new Error('Не удалось загрузить изображение'));
            };
            
            img.src = url;
        });
    }

    drawMosaic(scheme) {
        const grid = scheme.grid;
        const gridWidth = grid.width;
        const gridHeight = grid.height;
        
        if (!gridWidth || !gridHeight) {
            console.error('Невалидные размеры сетки:', { gridWidth, gridHeight });
            return;
        }
        
        const divider = Math.min(
            Math.floor(this.originalImg.naturalWidth / gridWidth),
            Math.floor(this.originalImg.naturalHeight / gridHeight)
        );
        
        if (divider < 1) {
            console.error('Divider должен быть > 0:', divider);
            return;
        }
        
        const canvasWidth = gridWidth * divider;
        const canvasHeight = gridHeight * divider;
        
        if (canvasWidth <= 0 || canvasHeight <= 0) {
            console.error('Размеры канваса должны быть > 0:', { canvasWidth, canvasHeight });
            return;
        }
        
        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        
        const imageData = this.ctx.createImageData(canvasWidth, canvasHeight);
        const data = imageData.data;
        
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
            
            const maskBytes = this.decodeMask(maskBase64);
            
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
        const binary = atob(base64Str);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        
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
        const nColors = scheme.n_colors;
        
        const paletteHeader = document.querySelector('.card-header h5');
        if (paletteHeader && paletteHeader.textContent.includes('🎨 Палитра цветов')) {
            paletteHeader.textContent = `🎨 Палитра (${nColors} цветов)`;
        }
        
        this.colorPalette.innerHTML = '';
        
        const sortedClusters = [...clusters].sort((a, b) => b.count - a.count);
        
        for (const cluster of sortedClusters) {
            const colorHex = cluster.color;
            const count = cluster.count;
            
            const item = document.createElement('div');
            item.className = 'color-palette-item';
            
            const colorBox = document.createElement('div');
            colorBox.className = 'color-box';
            colorBox.style.backgroundColor = `#${colorHex}`;
            
            const infoContainer = document.createElement('div');
            infoContainer.className = 'color-info';
            
            const hexLabel = document.createElement('div');
            hexLabel.className = 'color-hex';
            hexLabel.textContent = `Цвет: #${colorHex}`;
            
            const countLabel = document.createElement('div');
            countLabel.className = 'color-count';
            countLabel.textContent = `Количество: ${count}`;
            
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

    updateSummary(scheme) {
        const gridWidth = scheme.grid.width;
        const gridHeight = scheme.grid.height;
        
        if (this.summaryCanvasWidth) {
            this.summaryCanvasWidth.textContent = scheme.actual_size.width_mm + ' мм';
        }
        if (this.summaryCanvasHeight) {
            this.summaryCanvasHeight.textContent = scheme.actual_size.height_mm + ' мм ~ ' + scheme.area_m2 + ' м²';
        }
        if (this.summaryCellSize) {
            this.summaryCellSize.textContent = scheme.cell_size_mm + '×' + scheme.cell_size_mm + ' мм';
        }
        if (this.summaryTotalCells) {
            this.summaryTotalCells.textContent = gridWidth + ' x ' + gridHeight + ' = ' + scheme.total_cells;
        }
        if (this.summaryGap) {
            this.summaryGap.textContent = scheme.gap_mm + ' мм';
        }
    }

    setLoadingState(loading) {
        if (loading) {
            this.imageLoadingOverlay.classList.remove('d-none');
            this.imageLoadingOverlay.classList.add('d-flex');
            this.mosaicLoadingOverlay.classList.remove('d-none');
            this.mosaicLoadingOverlay.classList.add('d-flex');
            
            this.canvasWidthSlider.disabled = true;
            this.canvasWidthInput.disabled = true;
            this.cellSizeSlider.disabled = true;
            this.cellSizeInput.disabled = true;
            this.gapSlider.disabled = true;
            this.gapInput.disabled = true;
            this.colorsSlider.disabled = true;
            this.colorsInput.disabled = true;
            this.uploadBtn.disabled = true;
            this.resetBtn.disabled = true;
            this.resetImageBtn.disabled = true;
            
            this.dropZone.style.pointerEvents = 'none';
            this.dropZone.style.opacity = '0.6';
            
        } else {
            this.imageLoadingOverlay.classList.add('d-none');
            this.imageLoadingOverlay.classList.remove('d-flex');
            this.mosaicLoadingOverlay.classList.add('d-none');
            this.mosaicLoadingOverlay.classList.remove('d-flex');
            
            this.canvasWidthSlider.disabled = false;
            this.canvasWidthInput.disabled = false;
            this.cellSizeSlider.disabled = false;
            this.cellSizeInput.disabled = false;
            this.gapSlider.disabled = false;
            this.gapInput.disabled = false;
            this.colorsSlider.disabled = false;
            this.colorsInput.disabled = false;
            this.uploadBtn.disabled = false;
            this.resetBtn.disabled = false;
            this.resetImageBtn.disabled = false;
            
            this.dropZone.style.pointerEvents = 'auto';
            this.dropZone.style.opacity = '1';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.__initialData) {
        window.app = new MosaicApp(window.__initialData);
    } else {
        console.error('Нет начальных данных!');
    }
});
