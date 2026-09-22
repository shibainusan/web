// Vector CW Test Data Generator
// Generate +15MHz (or arbitrary frequency) CW signal for testing

function generateVectorCW(frequencyMHz = 15, durationMs = 1000, samplingRateMsps = 122.88) {
    const samplingRateHz = samplingRateMsps * 1e6;
    const frequencyHz = frequencyMHz * 1e6;
    const numSamples = Math.floor((durationMs / 1000) * samplingRateHz);

    // Create Float32Array for I and Q interleaved (I, Q, I, Q, ...)
    const iqData = new Float32Array(numSamples * 2);

    for (let n = 0; n < numSamples; n++) {
        const t = n / samplingRateHz;
        const phase = 2 * Math.PI * frequencyHz * t;

        // I = cos(phase), Q = sin(phase)
        iqData[n * 2] = Math.cos(phase);
        iqData[n * 2 + 1] = Math.sin(phase);
    }

    return iqData;
}

function generateVectorCWArrayBuffer(frequencyMHz = 15, durationMs = 1000, samplingRateMsps = 122.88) {
    const iqData = generateVectorCW(frequencyMHz, durationMs, samplingRateMsps);
    return iqData.buffer;
}

function generateChirp(startFreqMHz = 0, sweepVelocityMHzPerMs = 0.05, durationMs = 1000, samplingRateMsps = 122.88) {
    const samplingRateHz = samplingRateMsps * 1e6;
    const startFreqHz = startFreqMHz * 1e6;
    const sweepVelocityHz = sweepVelocityMHzPerMs * 1e6; // Hz/ms
    const numSamples = Math.floor((durationMs / 1000) * samplingRateHz);

    // Create Float32Array for I and Q interleaved (I, Q, I, Q, ...)
    const iqData = new Float32Array(numSamples * 2);

    for (let n = 0; n < numSamples; n++) {
        const t = n / samplingRateHz; // time in seconds
        const tMs = t * 1000; // time in milliseconds

        // Chirp: frequency increases linearly with time
        // f(t) = f0 + velocity * t
        const phase = 2 * Math.PI * (startFreqHz * t + (sweepVelocityHz / 2) * t * t);

        // I = cos(phase), Q = sin(phase)
        iqData[n * 2] = Math.cos(phase);
        iqData[n * 2 + 1] = Math.sin(phase);
    }

    return iqData;
}

function generateChirpArrayBuffer(startFreqMHz = 0, sweepVelocityMHzPerMs = 0.05, durationMs = 1000, samplingRateMsps = 122.88) {
    const iqData = generateChirp(startFreqMHz, sweepVelocityMHzPerMs, durationMs, samplingRateMsps);
    return iqData.buffer;
}
