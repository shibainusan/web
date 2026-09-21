// Canvas Waveform Renderer

class WaveformRenderer {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.width = canvasElement.width;
        this.height = canvasElement.height;

        this.padding = {
            top: 40,
            bottom: 50,
            left: 60,
            right: 20
        };

        this.graphWidth = this.width - this.padding.left - this.padding.right;
        this.graphHeight = this.height - this.padding.top - this.padding.bottom;

        this.isDarkMode = this.checkDarkMode();
        this.setupColors();
    }

    checkDarkMode() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return true;
        }
        return false;
    }

    setupColors() {
        if (this.isDarkMode) {
            this.colors = {
                bg: '#1e1e1e',
                fg: '#e0e0e0',
                grid: '#505050',
                gridLight: '#404040',
                waveform: '#4fa3ff',
                axis: '#e0e0e0'
            };
        } else {
            this.colors = {
                bg: '#ffffff',
                fg: '#000000',
                grid: '#d3d3d3',
                gridLight: '#e0e0e0',
                waveform: '#1f77b4',
                axis: '#000000'
            };
        }
    }

    drawBackground() {
        this.ctx.fillStyle = this.colors.bg;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawGrid() {
        this.ctx.strokeStyle = this.colors.gridLight;
        this.ctx.lineWidth = 0.5;
        this.ctx.beginPath();

        const gridX = 50;
        for (let x = this.padding.left; x < this.width - this.padding.right; x += gridX) {
            this.ctx.moveTo(x, this.padding.top);
            this.ctx.lineTo(x, this.height - this.padding.bottom);
        }

        const gridY = 40;
        for (let y = this.padding.top; y < this.height - this.padding.bottom; y += gridY) {
            this.ctx.moveTo(this.padding.left, y);
            this.ctx.lineTo(this.width - this.padding.right, y);
        }

        this.ctx.stroke();
    }

    drawAxes() {
        this.ctx.strokeStyle = this.colors.axis;
        this.ctx.lineWidth = 1;

        this.ctx.beginPath();
        this.ctx.moveTo(this.padding.left, this.padding.top);
        this.ctx.lineTo(this.padding.left, this.height - this.padding.bottom);
        this.ctx.lineTo(this.width - this.padding.right, this.height - this.padding.bottom);
        this.ctx.stroke();
    }

    drawAxisLabels(minAmplitude, maxAmplitude, startIndex, endIndex, samplingRateMsps = 122.88) {
        this.ctx.fillStyle = this.colors.fg;
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'middle';

        const ySteps = 5;
        for (let i = 0; i <= ySteps; i++) {
            const value = minAmplitude + (maxAmplitude - minAmplitude) * (i / ySteps);
            const y = this.height - this.padding.bottom - (this.graphHeight * i / ySteps);

            this.ctx.fillText(value.toFixed(2), this.padding.left - 10, y);
        }

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';

        const samplesPerMs = samplingRateMsps * 1e3;
        const xSteps = 5;
        for (let i = 0; i <= xSteps; i++) {
            const index = startIndex + (endIndex - startIndex) * (i / xSteps);
            const timeMs = index / samplesPerMs;
            const x = this.padding.left + (this.graphWidth * i / xSteps);

            this.ctx.fillText(timeMs.toFixed(3) + ' ms', x, this.height - this.padding.bottom + 10);
        }

        this.ctx.textAlign = 'left';
        this.ctx.font = '12px Arial';
        this.ctx.fillText('Amplitude', 10, this.padding.top - 15);
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Time (ms)', this.width / 2, this.height - 10);
    }

    drawWaveform(amplitudes, minAmplitude, maxAmplitude) {
        if (!amplitudes || amplitudes.length === 0) {
            return;
        }

        const amplitude = maxAmplitude - minAmplitude;
        if (amplitude === 0) {
            return;
        }

        this.ctx.strokeStyle = this.colors.waveform;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();

        for (let i = 0; i < amplitudes.length; i++) {
            const x = this.padding.left + (this.graphWidth * i / (amplitudes.length - 1 || 1));
            const normalized = (amplitudes[i] - minAmplitude) / amplitude;
            const y = this.height - this.padding.bottom - (normalized * this.graphHeight);

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.stroke();
    }

    clear() {
        this.ctx.fillStyle = this.colors.bg;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    render(amplitudes, minAmplitude, maxAmplitude, startIndex, endIndex, samplingRateMsps = 122.88, marker1Time = null, marker2Time = null, startTimeMs = 0, endTimeMs = 81.38) {
        this.clear();
        this.drawBackground();
        this.drawGrid();
        this.drawAxes();
        this.drawWaveform(amplitudes, minAmplitude, maxAmplitude);
        this.drawAxisLabels(minAmplitude, maxAmplitude, startIndex, endIndex, samplingRateMsps);
        if (marker1Time !== null) {
            this.drawMarker(marker1Time, startTimeMs, endTimeMs, '#ff0000');
        }
        if (marker2Time !== null) {
            this.drawMarker(marker2Time, startTimeMs, endTimeMs, '#00cc00');
        }
    }

    drawMarker(timeMs, startTimeMs, endTimeMs, color) {
        const timeRange = endTimeMs - startTimeMs;
        if (timeRange <= 0) return;

        const relativePos = (timeMs - startTimeMs) / timeRange;
        if (relativePos < 0 || relativePos > 1) return;

        const x = this.padding.left + this.graphWidth * relativePos;

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, this.padding.top);
        this.ctx.lineTo(x, this.height - this.padding.bottom);
        this.ctx.stroke();
    }
}
