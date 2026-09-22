// Spectrum analysis helpers (window, windowed FFT, level conversion)
// Depends on fft.js

const DB_FLOOR_EPSILON = 1e-10;

const hammingWindowCache = new Map();
const fftInstanceCache = new Map();

// Hamming window coefficients with the sums used for level correction
//   sum      : Σw   (coherent gain, amplitude correction)
//   powerSum : Σw²  (power correction)
function getHammingWindow(size) {
    let win = hammingWindowCache.get(size);
    if (!win) {
        const coeffs = new Float64Array(size);
        let sum = 0;
        let powerSum = 0;
        for (let i = 0; i < size; i++) {
            const w = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (size - 1));
            coeffs[i] = w;
            sum += w;
            powerSum += w * w;
        }
        win = { size, coeffs, sum, powerSum };
        hammingWindowCache.set(size, win);
    }
    return win;
}

function getFFT(size) {
    let fft = fftInstanceCache.get(size);
    if (!fft) {
        fft = new FFT(size);
        fftInstanceCache.set(size, fft);
    }
    return fft;
}

// Hamming-windowed FFT of complex IQ samples starting at startSample.
// Samples beyond the end of data are zero-padded.
// Returns interleaved complex spectrum [re0, im0, re1, im1, ...]
function computeWindowedFFT(iValues, qValues, startSample, fftSize) {
    const win = getHammingWindow(fftSize);
    const fft = getFFT(fftSize);
    const spectrum = fft.createComplexArray();
    const count = Math.max(0, Math.min(fftSize, iValues.length - startSample));
    for (let i = 0; i < count; i++) {
        const w = win.coeffs[i];
        spectrum[2 * i] = iValues[startSample + i] * w;
        spectrum[2 * i + 1] = qValues[startSample + i] * w;
    }
    fft.transform(spectrum);
    return spectrum;
}

// Magnitude spectrum in dB, amplitude-corrected by Σw (a CW peak reads its amplitude)
function spectrumToMagnitudeDb(spectrum) {
    const fftSize = spectrum.length / 2;
    const win = getHammingWindow(fftSize);
    const magnitudeDb = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
        const real = spectrum[2 * i];
        const imag = spectrum[2 * i + 1];
        const mag = Math.sqrt(real * real + imag * imag) / win.sum;
        magnitudeDb[i] = 20 * Math.log10(mag + DB_FLOOR_EPSILON);
    }
    return magnitudeDb;
}

// Total power (mean |x|²) by Parseval with window power correction: P = Σ|X|² / (N·Σw²)
function spectrumTotalPower(spectrum) {
    const fftSize = spectrum.length / 2;
    const win = getHammingWindow(fftSize);
    let sum = 0;
    for (let i = 0; i < fftSize; i++) {
        const real = spectrum[2 * i];
        const imag = spectrum[2 * i + 1];
        sum += real * real + imag * imag;
    }
    return sum / (fftSize * win.powerSum);
}

// Mean |x|² of the (unwindowed) samples in [startSample, startSample + length), divided by length
function timeDomainPower(iValues, qValues, startSample, length) {
    const end = Math.min(startSample + length, iValues.length);
    let sum = 0;
    for (let idx = startSample; idx < end; idx++) {
        sum += iValues[idx] * iValues[idx] + qValues[idx] * qValues[idx];
    }
    return sum / length;
}

// FFT bin index -> frequency (Hz). Bins N/2..N-1 are negative frequencies.
function binToFrequencyHz(bin, fftSize, samplingRateHz) {
    const signedBin = bin < fftSize / 2 ? bin : bin - fftSize;
    return signedBin * samplingRateHz / fftSize;
}

function createFrequencyAxis(fftSize, samplingRateHz) {
    const frequencies = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
        frequencies[i] = binToFrequencyHz(i, fftSize, samplingRateHz);
    }
    return frequencies;
}

// Spectrogram (frames x bins, magnitude dB) over [startSample, endSample)
function computeSpectrogram(iValues, qValues, startSample, endSample, fftSize, hopSize) {
    const numFrames = Math.floor((endSample - startSample - fftSize) / hopSize) + 1;
    const spectrogram = [];
    for (let frame = 0; frame < numFrames; frame++) {
        const spectrum = computeWindowedFFT(iValues, qValues, startSample + frame * hopSize, fftSize);
        spectrogram.push(spectrumToMagnitudeDb(spectrum));
    }
    return spectrogram;
}
