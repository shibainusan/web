// Test Validators for Vector CW Signals

function validateFFTPeak(iValues, qValues, expectedFreqMHz = 15, toleranceMHz = 0.5, samplingRateMsps = 122.88) {
    if (!iValues || !qValues || iValues.length === 0) {
        return { passed: false, detectedPeakMHz: null, peakMagnitudeDb: null, error: "Invalid input data" };
    }

    const fftSize = Math.min(1024, iValues.length);
    const spectrum = computeWindowedFFT(iValues, qValues, 0, fftSize);
    const magnitude = spectrumToMagnitudeDb(spectrum);

    // Find peak across all frequencies (positive and negative)
    let peakBinIdx = 0;
    let peakMagnitude = magnitude[0];

    // Search all frequency bins
    for (let i = 1; i < fftSize; i++) {
        if (magnitude[i] > peakMagnitude) {
            peakMagnitude = magnitude[i];
            peakBinIdx = i;
        }
    }

    // Previous implementation normalized by 2/Σw (one-sided spectrum convention); keep its +6.02 dB offset
    peakMagnitude += 20 * Math.log10(2);

    const detectedFreqMHz = binToFrequencyHz(peakBinIdx, fftSize, samplingRateMsps * 1e6) / 1e6;

    // Check if within tolerance
    const freqDiff = Math.abs(detectedFreqMHz - expectedFreqMHz);
    const passed = freqDiff <= toleranceMHz;

    return {
        passed: passed,
        detectedPeakMHz: detectedFreqMHz,
        peakMagnitudeDb: peakMagnitude,
        expectedFreqMHz: expectedFreqMHz,
        toleranceMHz: toleranceMHz,
        freqDiffMHz: freqDiff
    };
}

function validateWaveformData(iValues, qValues, expectedFreqMHz = 15) {
    if (!iValues || !qValues || iValues.length === 0) {
        return { passed: false, iqAmplitude: null, dataValid: false, error: "Invalid input data" };
    }

    // Calculate RMS of I and Q
    let iRMS = 0, qRMS = 0;
    for (let i = 0; i < iValues.length; i++) {
        iRMS += iValues[i] * iValues[i];
        qRMS += qValues[i] * qValues[i];
    }
    iRMS = Math.sqrt(iRMS / iValues.length);
    qRMS = Math.sqrt(qRMS / qValues.length);

    // For Vector CW: I and Q should have similar RMS (both ~0.707 for -3dB normalized)
    const avgRMS = (iRMS + qRMS) / 2;
    const iqAmplitude = Math.sqrt(iRMS * iRMS + qRMS * qRMS);

    // Check if amplitude is in normal range (0.8 to 1.2)
    const passed = iqAmplitude >= 0.8 && iqAmplitude <= 1.2;
    const dataValid = iRMS > 0 && qRMS > 0 && Math.abs(iRMS - qRMS) < 0.2;

    return {
        passed: passed && dataValid,
        iqAmplitude: iqAmplitude,
        iRMS: iRMS,
        qRMS: qRMS,
        dataValid: dataValid,
        expectedFreqMHz: expectedFreqMHz
    };
}

function validateSpectrogramEnergy(spectrogram, expectedFreqMHz = 15, toleranceMHz = 0.5, samplingRateMsps = 122.88) {
    if (!spectrogram || spectrogram.length === 0 || spectrogram[0].length === 0) {
        return { passed: false, maxEnergyFreq: null, maxEnergy: null, error: "Invalid spectrogram data" };
    }

    const fftSize = spectrogram[0].length;

    // Average energy across all frames
    const avgEnergy = new Float32Array(fftSize);
    for (let binIdx = 0; binIdx < fftSize; binIdx++) {
        let sum = 0;
        for (let frameIdx = 0; frameIdx < spectrogram.length; frameIdx++) {
            sum += Math.pow(10, spectrogram[frameIdx][binIdx] / 10); // Convert from dB
        }
        avgEnergy[binIdx] = sum / spectrogram.length;
    }

    // Find peak energy bin
    let peakBinIdx = 0;
    let peakEnergy = avgEnergy[0];
    for (let i = 1; i < fftSize; i++) {
        if (avgEnergy[i] > peakEnergy) {
            peakEnergy = avgEnergy[i];
            peakBinIdx = i;
        }
    }

    const maxEnergyFreqMHz = binToFrequencyHz(peakBinIdx, fftSize, samplingRateMsps * 1e6) / 1e6;

    // Check if within tolerance
    const freqDiff = Math.abs(maxEnergyFreqMHz - expectedFreqMHz);
    const passed = freqDiff <= toleranceMHz;

    return {
        passed: passed,
        maxEnergyFreq: maxEnergyFreqMHz,
        maxEnergy: peakEnergy,
        expectedFreqMHz: expectedFreqMHz,
        toleranceMHz: toleranceMHz,
        freqDiffMHz: freqDiff
    };
}
