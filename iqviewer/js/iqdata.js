// IQ Data Processing Class

class IQData {
    constructor() {
        this.rawData = null;
        this.rawArrayBuffer = null;
        this.amplitudes = null;
        this.iValues = null;
        this.qValues = null;
        this.sampleCount = 0;
        this.fileSize = 0;
        this.fileName = '';
        this.currentScale = 'absolute';
    }

    async loadFromArrayBuffer(arrayBuffer, fileName, scale = 'absolute') {
        this.fileSize = arrayBuffer.byteLength;
        this.fileName = fileName;
        this.rawArrayBuffer = arrayBuffer;
        this.currentScale = scale;

        const float32View = new Float32Array(arrayBuffer);
        this.sampleCount = Math.floor(float32View.length / 2);

        this.iValues = new Float32Array(this.sampleCount);
        this.qValues = new Float32Array(this.sampleCount);
        this.amplitudes = new Float32Array(this.sampleCount);

        for (let i = 0; i < this.sampleCount; i++) {
            let iVal = float32View[i * 2];
            let qVal = float32View[i * 2 + 1];

            if (scale === 'adc16') {
                iVal = iVal / 32768;
                qVal = qVal / 32768;
            }

            this.iValues[i] = iVal;
            this.qValues[i] = qVal;
            this.amplitudes[i] = calculateAmplitude(iVal, qVal);
        }

        this.rawData = float32View;

        return {
            sampleCount: this.sampleCount,
            fileSize: this.fileSize,
            fileName: this.fileName,
            minAmplitude: findMinMax(Array.from(this.amplitudes)).min,
            maxAmplitude: findMinMax(Array.from(this.amplitudes)).max
        };
    }

    reprocessWithScale(scale) {
        if (!this.rawArrayBuffer) {
            return null;
        }
        return this.loadFromArrayBuffer(this.rawArrayBuffer, this.fileName, scale);
    }

    getAmplitudeData(startIndex, endIndex) {
        if (!this.amplitudes) {
            return null;
        }

        startIndex = Math.max(0, Math.floor(startIndex));
        endIndex = Math.min(this.sampleCount, Math.ceil(endIndex));

        if (startIndex >= endIndex) {
            return null;
        }

        const data = this.amplitudes.slice(startIndex, endIndex);
        return {
            data: Array.from(data),
            startIndex: startIndex,
            endIndex: endIndex,
            length: endIndex - startIndex
        };
    }

    getAmplitudeDataDownsampled(startIndex, endIndex, maxPoints, amplitudeUnit = 'rms') {
        const rawData = this.getAmplitudeData(startIndex, endIndex);
        if (!rawData) {
            return null;
        }

        let downsampled = downsampleMinMax(rawData.data, maxPoints);

        // Convert to dB if requested
        if (amplitudeUnit === 'db') {
            downsampled = downsampled.map(amp => this.convertAmplitudeToDb(amp));
        }

        return {
            data: downsampled,
            startIndex: rawData.startIndex,
            endIndex: rawData.endIndex,
            originalLength: rawData.length,
            displayLength: downsampled.length
        };
    }

    convertAmplitudeToDb(amplitude) {
        if (amplitude <= 0) return -Infinity;
        return Math.log10(amplitude) * 20;
    }

    getIQData(startIndex, endIndex) {
        if (!this.iValues || !this.qValues) {
            return null;
        }

        startIndex = Math.max(0, Math.floor(startIndex));
        endIndex = Math.min(this.sampleCount, Math.ceil(endIndex));

        if (startIndex >= endIndex) {
            return null;
        }

        return {
            i: Array.from(this.iValues.slice(startIndex, endIndex)),
            q: Array.from(this.qValues.slice(startIndex, endIndex)),
            startIndex: startIndex,
            endIndex: endIndex
        };
    }

    getMetadata() {
        return {
            fileName: this.fileName,
            fileSize: this.fileSize,
            sampleCount: this.sampleCount,
            iqPairCount: this.sampleCount
        };
    }

    getPowerStatistics() {
        if (!this.iValues || !this.qValues || this.sampleCount === 0) {
            return null;
        }

        let sumPower = 0;
        let maxPower = 0;
        let minPower = Infinity;

        for (let i = 0; i < this.sampleCount; i++) {
            const iVal = this.iValues[i];
            const qVal = this.qValues[i];
            const power = iVal * iVal + qVal * qVal;

            sumPower += power;
            if (power > maxPower) {
                maxPower = power;
            }
            if (power < minPower) {
                minPower = power;
            }
        }

        const rms = Math.sqrt(sumPower / this.sampleCount);
        const averageDb = rms > 0 ? Math.log10(rms) * 20 : -Infinity;
        const peakDb = maxPower > 0 ? Math.log10(Math.sqrt(maxPower)) * 20 : -Infinity;

        let bottomDb;
        if (minPower === 0) {
            bottomDb = this.currentScale === 'adc16' ? -96 : -130;
        } else if (minPower > 0 && minPower < Infinity) {
            bottomDb = Math.log10(Math.sqrt(minPower)) * 20;
        } else {
            bottomDb = -Infinity;
        }

        return {
            rms: rms,
            averageDb: averageDb,
            peakDb: peakDb,
            bottomDb: bottomDb
        };
    }

    getStatistics() {
        if (!this.amplitudes) {
            return null;
        }

        const ampArray = Array.from(this.amplitudes);
        const { min, max } = findMinMax(ampArray);

        let sum = 0;
        for (let i = 0; i < ampArray.length; i++) {
            sum += ampArray[i];
        }
        const mean = sum / ampArray.length;

        let variance = 0;
        for (let i = 0; i < ampArray.length; i++) {
            variance += (ampArray[i] - mean) ** 2;
        }
        const stdDev = Math.sqrt(variance / ampArray.length);

        return {
            min: min,
            max: max,
            mean: mean,
            stdDev: stdDev,
            sampleCount: this.sampleCount
        };
    }
}
