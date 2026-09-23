// Main Application Logic

let iqData = new IQData();
let renderer;
let marker1Time = null;
let marker1Amplitude = null;
let marker2Time = null;
let marker2Amplitude = null;
let markerMode = null; // 'marker1' or 'marker2'
let spectrogramHopSize = 512; // Default 50% overlap

function getSamplingRateMsps() {
    return parseFloat(elements.samplingRateSelector.value);
}

function getSamplingRateSamplesPerMs() {
    return getSamplingRateMsps() * 1e3;
}

function sampleToMs(sample) {
    return sample / getSamplingRateSamplesPerMs();
}

function msToSample(ms) {
    return Math.round(ms * getSamplingRateSamplesPerMs());
}

const elements = {
    fileInput: document.getElementById('fileInput'),
    fileLabel: document.querySelector('.file-label'),
    iqFormatSelector: document.getElementById('iqFormatSelector'),
    fileName: document.getElementById('fileName'),
    fileSize: document.getElementById('fileSize'),
    sampleCount: document.getElementById('sampleCount'),
    rms: document.getElementById('rms'),
    averageDb: document.getElementById('averageDb'),
    peakDb: document.getElementById('peakDb'),
    bottomDb: document.getElementById('bottomDb'),
    scaleSelector: document.getElementById('scaleSelector'),
    samplingRateSelector: document.getElementById('samplingRateSelector'),
    amplitudeUnit: document.getElementById('amplitudeUnit'),
    startIndex: document.getElementById('startIndex'),
    endIndex: document.getElementById('endIndex'),
    startTime: document.getElementById('startTime'),
    endTime: document.getElementById('endTime'),
    startTimeSlider: document.getElementById('startTimeSlider'),
    endTimeSlider: document.getElementById('endTimeSlider'),
    startTimeValue: document.getElementById('startTimeValue'),
    endTimeValue: document.getElementById('endTimeValue'),
    zoomSlider: document.getElementById('zoomSlider'),
    zoomValue: document.getElementById('zoomValue'),
    setMarker1Button: document.getElementById('setMarker1Button'),
    setMarker2Button: document.getElementById('setMarker2Button'),
    clearMarkersButton: document.getElementById('clearMarkersButton'),
    marker1Value: document.getElementById('marker1Value'),
    marker2Value: document.getElementById('marker2Value'),
    burstLengthValue: document.getElementById('burstLengthValue'),
    canvas: document.getElementById('waveformCanvas'),
    fftCanvas: document.getElementById('fftCanvas'),
    fftTotalPowerLinear: document.getElementById('fftTotalPowerLinear'),
    fftTotalPowerDb: document.getElementById('fftTotalPowerDb'),
    fftTimedomainPowerLinear: document.getElementById('fftTimedomainPowerLinear'),
    fftTimedomainPowerDb: document.getElementById('fftTimedomainPowerDb'),
    spectrogramCanvas: document.getElementById('spectrogramCanvas'),
    spectrogramOverlapSelector: document.getElementById('spectrogramOverlapSelector'),
    statusLog: document.getElementById('statusLog'),
    progress: document.getElementById('progress'),
    progressFill: document.getElementById('progressFill')
};

function init() {
    renderer = new WaveformRenderer(elements.canvas);

    setupEventListeners();
    updateUI();
}

function setupEventListeners() {
    elements.fileInput.addEventListener('change', handleFileSelect);

    elements.fileLabel.addEventListener('dragover', handleDragOver);
    elements.fileLabel.addEventListener('dragleave', handleDragLeave);
    elements.fileLabel.addEventListener('drop', handleFileDrop);

    elements.scaleSelector.addEventListener('change', handleScaleChange);
    elements.samplingRateSelector.addEventListener('change', handleSamplingRateChange);
    elements.iqFormatSelector.addEventListener('change', handleIQFormatChange);
    elements.amplitudeUnit.addEventListener('change', handleAmplitudeUnitChange);
    elements.startTime.addEventListener('change', debounce(handleTimeRangeChange, 300));
    elements.endTime.addEventListener('change', debounce(handleTimeRangeChange, 300));
    elements.startTimeSlider.addEventListener('input', handleStartTimeSliderChange);
    elements.endTimeSlider.addEventListener('input', handleEndTimeSliderChange);
    elements.zoomSlider.addEventListener('input', handleZoomChange);
    elements.spectrogramOverlapSelector.addEventListener('change', handleSpectrogramOverlapChange);

    elements.setMarker1Button.addEventListener('click', () => startMarkerMode('marker1'));
    elements.setMarker2Button.addEventListener('click', () => startMarkerMode('marker2'));
    elements.clearMarkersButton.addEventListener('click', clearMarkers);
    elements.canvas.addEventListener('click', handleCanvasClick);

    // Test Control listeners
    document.getElementById('testWaveformType').addEventListener('change', handleWaveformTypeChange);
    document.getElementById('generateTestDataBtn').addEventListener('click', generateTestData);
    document.getElementById('runTestBtn').addEventListener('click', runVectorCWTest);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        renderer.isDarkMode = renderer.checkDarkMode();
        renderer.setupColors();
        updateWaveform();
    });
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        loadFile(file);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    elements.fileLabel.parentElement.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.preventDefault();
    elements.fileLabel.parentElement.classList.remove('drag-over');
}

function handleFileDrop(event) {
    event.preventDefault();
    elements.fileLabel.parentElement.classList.remove('drag-over');

    const files = event.dataTransfer.files;
    if (files.length > 0) {
        loadFile(files[0]);
    }
}

async function loadFile(file) {
    try {
        setStatus('Loading file...');
        showProgress();

        const arrayBuffer = await file.arrayBuffer();
        const loadiqFormat = elements.iqFormatSelector.value;
        const loadscale = elements.scaleSelector.value;

        setStatus('Processing data...');
        const metadata = await iqData.loadFromArrayBuffer(arrayBuffer, file.name, loadiqFormat, loadscale);

        elements.startIndex.max = metadata.sampleCount - 1;
        elements.endIndex.max = metadata.sampleCount - 1;
        elements.startIndex.value = 0;
        elements.endIndex.value = metadata.sampleCount - 1;
        elements.zoomSlider.value = 100;
        elements.zoomValue.textContent = '100';

        updateTimeRange();
        updateTimeSliders();
        elements.startTimeSlider.value = 0;
        elements.endTimeSlider.value = sampleToMs(metadata.sampleCount - 1);
        elements.startTimeValue.textContent = '0.000';
        elements.endTimeValue.textContent = sampleToMs(metadata.sampleCount - 1).toFixed(3);

        updateUI();
        updateWaveform();

        // Set default markers and calculate FFT/Spectrogram
        const totalTimeMs = sampleToMs(metadata.sampleCount - 1);
        marker1Time = 0;
        marker1Amplitude = iqData.amplitudes[0];
        marker2Time = totalTimeMs;
        marker2Amplitude = iqData.amplitudes[iqData.sampleCount - 1];

        // Update marker display
        elements.marker1Value.textContent = `${marker1Time.toFixed(3)} ms (${iqData.convertAmplitudeToDb(marker1Amplitude).toFixed(2)} dB)`;
        elements.marker2Value.textContent = `${marker2Time.toFixed(3)} ms (${iqData.convertAmplitudeToDb(marker2Amplitude).toFixed(2)} dB)`;

        // Update burst length and calculate FFT/Spectrogram
        updateBurstLength();
        calculateFFT();
        calculateSpectrogram();

        elements.scaleSelector.disabled = false;
        setStatus(`File loaded: ${file.name} - Markers set (0 to ${totalTimeMs.toFixed(3)}ms) - FFT & Spectrogram calculated`);
    } catch (error) {
        setStatus(`Error: ${error.message}`);
        console.error('File loading error:', error);
    } finally {
        hideProgress();
    }
}

function updateUI() {
    const metadata = iqData.getMetadata();

    if (metadata.sampleCount === 0) {
        elements.fileName.textContent = '-';
        elements.fileSize.textContent = '-';
        elements.sampleCount.textContent = '-';
        elements.rms.textContent = '-';
        elements.averageDb.textContent = '-';
        elements.peakDb.textContent = '-';
        elements.bottomDb.textContent = '-';
        elements.startIndex.value = 0;
        elements.endIndex.value = 0;
        return;
    }

    elements.fileName.textContent = metadata.fileName || '-';
    elements.fileSize.textContent = formatFileSize(metadata.fileSize);
    elements.sampleCount.textContent = formatNumber(metadata.iqPairCount);

    const powerStats = iqData.getPowerStatistics();
    if (powerStats) {
        elements.rms.textContent = powerStats.rms.toFixed(6);
        elements.averageDb.textContent = isFinite(powerStats.averageDb) ? powerStats.averageDb.toFixed(2) + ' dB' : '-';
        elements.peakDb.textContent = isFinite(powerStats.peakDb) ? powerStats.peakDb.toFixed(2) + ' dB' : '-';
        elements.bottomDb.textContent = isFinite(powerStats.bottomDb) ? powerStats.bottomDb.toFixed(2) + ' dB' : '-';
    } else {
        elements.rms.textContent = '-';
        elements.averageDb.textContent = '-';
        elements.peakDb.textContent = '-';
        elements.bottomDb.textContent = '-';
    }
}

function updateWaveform() {
    if (iqData.sampleCount === 0) {
        renderer.clear();
        return;
    }

    const startMs = parseFloat(elements.startTime.value) || 0;
    const endMs = parseFloat(elements.endTime.value) || sampleToMs(iqData.sampleCount);

    const startIndex = Math.max(0, msToSample(startMs));
    const endIndex = Math.min(iqData.sampleCount, msToSample(endMs));

    if (startIndex >= endIndex) {
        setStatus('Invalid range');
        return;
    }

    const amplitudeUnit = elements.amplitudeUnit.value;
    const displayData = iqData.getAmplitudeDataDownsampled(startIndex, endIndex, elements.canvas.width, amplitudeUnit);

    if (!displayData) {
        renderer.clear();
        setStatus('No data');
        return;
    }

    let minValue, maxValue;
    if (amplitudeUnit === 'db') {
        // For dB, use Bottom dB and Peak dB
        const ampStats = iqData.getPowerStatistics();
        minValue = ampStats && isFinite(ampStats.bottomDb) ? ampStats.bottomDb : -100;
        maxValue = ampStats ? ampStats.peakDb : 0;
    } else {
        // For RMS, use original statistics
        const stats = iqData.getStatistics();
        minValue = stats.min;
        maxValue = stats.max;
    }

    const samplingRateMsps = getSamplingRateMsps();
    const startTimeMs = parseFloat(elements.startTime.value) || 0;
    const endTimeMs = parseFloat(elements.endTime.value) || sampleToMs(iqData.sampleCount);

    renderer.render(
        displayData.data,
        minValue,
        maxValue,
        startIndex,
        endIndex,
        samplingRateMsps,
        marker1Time,
        marker2Time,
        startTimeMs,
        endTimeMs
    );

    setStatus(`Displaying: ${formatNumber(startIndex)} - ${formatNumber(endIndex - 1)} (${formatNumber(displayData.originalLength)} samples)`);
}

function handleZoomChange(event) {
    const zoom = parseInt(event.target.value);
    elements.zoomValue.textContent = zoom;

    const currentStartMs = parseFloat(elements.startTime.value) || 0;
    const currentEndMs = parseFloat(elements.endTime.value) || sampleToMs(iqData.sampleCount);
    const centerMs = (currentStartMs + currentEndMs) / 2;

    const totalTimeMs = sampleToMs(iqData.sampleCount);
    const rangeSizeMs = totalTimeMs * 100 / zoom;
    const newStartMs = Math.max(0, centerMs - rangeSizeMs / 2);
    const newEndMs = Math.min(totalTimeMs, centerMs + rangeSizeMs / 2);

    elements.startTime.value = newStartMs.toFixed(3);
    elements.endTime.value = newEndMs.toFixed(3);
    updateWaveform();
}

function startMarkerMode(mode) {
    markerMode = markerMode === mode ? null : mode;
    if (markerMode === 'marker1') {
        elements.setMarker1Button.style.backgroundColor = '#0056b3';
        elements.setMarker1Button.style.color = 'white';
        elements.setMarker2Button.style.backgroundColor = 'transparent';
        elements.setMarker2Button.style.color = '#007bff';
        setStatus('Click on graph to set Marker 1');
    } else if (markerMode === 'marker2') {
        elements.setMarker2Button.style.backgroundColor = '#0056b3';
        elements.setMarker2Button.style.color = 'white';
        elements.setMarker1Button.style.backgroundColor = 'transparent';
        elements.setMarker1Button.style.color = '#007bff';
        setStatus('Click on graph to set Marker 2');
    } else {
        elements.setMarker1Button.style.backgroundColor = 'transparent';
        elements.setMarker1Button.style.color = '#007bff';
        elements.setMarker2Button.style.backgroundColor = 'transparent';
        elements.setMarker2Button.style.color = '#007bff';
        setStatus('Marker mode cancelled');
    }
}

function handleCanvasClick(event) {
    if (!markerMode) return;

    const rect = elements.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const startMs = parseFloat(elements.startTime.value) || 0;
    const endMs = parseFloat(elements.endTime.value) || sampleToMs(iqData.sampleCount);

    const padding = renderer.padding;
    const graphWidth = renderer.graphWidth;

    if (x < padding.left || x > (elements.canvas.width - padding.right)) {
        return;
    }

    const relativeX = (x - padding.left) / graphWidth;
    const timeMs = startMs + (endMs - startMs) * relativeX;
    const sampleIndex = msToSample(timeMs);

    // Get amplitude at this sample
    let amplitude = null;
    const amplitudeUnit = elements.amplitudeUnit.value;

    if (sampleIndex >= 0 && sampleIndex < iqData.sampleCount) {
        amplitude = iqData.amplitudes[Math.floor(sampleIndex)];

        if (amplitudeUnit === 'db') {
            amplitude = iqData.convertAmplitudeToDb(amplitude);
        }
    }

    if (markerMode === 'marker1') {
        marker1Time = timeMs;
        marker1Amplitude = amplitude;
        const ampStr = amplitude !== null ? ` (${amplitude.toFixed(2)})` : '';
        elements.marker1Value.textContent = timeMs.toFixed(3) + ' ms' + ampStr;
        updateBurstLength();
        calculateFFT();
        startMarkerMode(null);
    } else if (markerMode === 'marker2') {
        marker2Time = timeMs;
        marker2Amplitude = amplitude;
        const ampStr = amplitude !== null ? ` (${amplitude.toFixed(2)})` : '';
        elements.marker2Value.textContent = timeMs.toFixed(3) + ' ms' + ampStr;
        updateBurstLength();
        startMarkerMode(null);
    }

    updateWaveform();
}

function updateBurstLength() {
    if (marker1Time !== null && marker2Time !== null) {
        const burstLength = Math.abs(marker2Time - marker1Time);
        elements.burstLengthValue.textContent = burstLength.toFixed(3) + ' ms';
        calculateSpectrogram();
    }
}

function clearMarkers() {
    marker1Time = null;
    marker1Amplitude = null;
    marker2Time = null;
    marker2Amplitude = null;
    markerMode = null;
    elements.marker1Value.textContent = '-';
    elements.marker2Value.textContent = '-';
    elements.burstLengthValue.textContent = '-';
    elements.setMarker1Button.style.backgroundColor = 'transparent';
    elements.setMarker1Button.style.color = '#007bff';
    elements.setMarker2Button.style.backgroundColor = 'transparent';
    elements.setMarker2Button.style.color = '#007bff';
    updateWaveform();
}

function calculateFFT() {
    if (marker1Time === null || iqData.sampleCount === 0) {
        clearFFT();
        return;
    }

    const fftSize = 1024;
    const startSample = msToSample(marker1Time);
    const endSample = Math.min(startSample + fftSize, iqData.sampleCount);

    if (endSample - startSample < fftSize) {
        setStatus('Not enough samples for 1024-point FFT');
        clearFFT();
        return;
    }

    const timedomainPower = timeDomainPower(iqData.iValues, iqData.qValues, startSample, fftSize);
    const spectrum = computeWindowedFFT(iqData.iValues, iqData.qValues, startSample, fftSize);
    const magnitude = spectrumToMagnitudeDb(spectrum);
    const fftPowerLinear = spectrumTotalPower(spectrum);
    const frequencies = createFrequencyAxis(fftSize, getSamplingRateMsps() * 1e6);

    // Get min/max values to match Waveform Display
    const amplitudeUnit = elements.amplitudeUnit.value;
    let minValue, maxValue;
    if (amplitudeUnit === 'db') {
        // For dB, use Bottom dB and Peak dB
        const ampStats = iqData.getPowerStatistics();
        minValue = ampStats && isFinite(ampStats.bottomDb) ? ampStats.bottomDb : -100;
        maxValue = ampStats ? ampStats.peakDb : 0;
    } else {
        // For RMS, use original statistics
        const stats = iqData.getStatistics();
        minValue = stats.min;
        maxValue = stats.max;
    }

    // Calculate total in-band power
    calculateTotalPower(fftPowerLinear, timedomainPower);

    drawFFT(magnitude, frequencies, minValue, maxValue);
}

function calculateTotalPower(fftPowerLinear, timedomainPower) {
    // Display FFT results
    elements.fftTotalPowerLinear.textContent = fftPowerLinear.toFixed(6);

    // Convert to dB (RMS power)
    const totalPowerDb = 10 * Math.log10(fftPowerLinear + 1e-10);
    elements.fftTotalPowerDb.textContent = totalPowerDb.toFixed(2) + ' dB';

    // Display TimeDomain results
    if (timedomainPower !== undefined) {
        elements.fftTimedomainPowerLinear.textContent = timedomainPower.toFixed(6);
        const timedomainPowerDb = 10 * Math.log10(timedomainPower + 1e-10);
        elements.fftTimedomainPowerDb.textContent = timedomainPowerDb.toFixed(2) + ' dB';
    }
}

function drawFFT(magnitude, frequencies, minValue, maxValue) {
    const ctx = elements.fftCanvas.getContext('2d');
    const width = elements.fftCanvas.width;
    const height = elements.fftCanvas.height;
    const padding = 50;

    // Check dark mode
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const bgColor = isDarkMode ? '#1e1e1e' : '#ffffff';
    const fgColor = isDarkMode ? '#e0e0e0' : '#000000';
    const waveColor = isDarkMode ? '#4fa3ff' : '#1f77b4';
    const gridColor = isDarkMode ? '#505050' : '#d3d3d3';

    // Clear canvas
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    const gridSpacing = 50;
    for (let x = padding; x < width - padding; x += gridSpacing) {
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
    }
    for (let y = padding; y < height - padding; y += gridSpacing) {
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
    }
    ctx.stroke();

    // Draw axes
    ctx.strokeStyle = fgColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Use Waveform Display's min/max values
    const minMag = minValue !== undefined ? minValue : -100;
    const maxMag = maxValue !== undefined ? maxValue : 0;

    // Draw magnitude spectrum (with fft shift for proper display)
    ctx.strokeStyle = waveColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const graphWidth = width - 2 * padding;
    const graphHeight = height - 2 * padding;

    // Rearrange FFT output for proper display (-fs/2 to fs/2)
    const fftSize = magnitude.length;
    for (let displayIdx = 0; displayIdx < fftSize; displayIdx++) {
        // Map display index to FFT bin index
        let fftIdx;
        if (displayIdx < fftSize / 2) {
            fftIdx = displayIdx + fftSize / 2;  // Positive frequencies
        } else {
            fftIdx = displayIdx - fftSize / 2;  // Negative frequencies
        }

        const x = padding + (displayIdx / fftSize) * graphWidth;
        const normalized = (magnitude[fftIdx] - minMag) / (maxMag - minMag || 1);
        const y = height - padding - normalized * graphHeight;

        if (displayIdx === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();

    // Draw DC (0 Hz) line
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    const dcX = padding + (fftSize / 2 / fftSize) * graphWidth;
    ctx.moveTo(dcX, padding);
    ctx.lineTo(dcX, height - padding);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Draw frequency axis labels
    ctx.fillStyle = fgColor;
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const samplingRateMsps = getSamplingRateMsps();
    const samplingRateHz = samplingRateMsps * 1e6;
    const maxFreq = samplingRateHz / 2;
    const freqSteps = 5;
    for (let i = 0; i <= freqSteps; i++) {
        const freqNorm = i / freqSteps;
        const freq = -maxFreq + freqNorm * (2 * maxFreq);
        const freqMHz = freq / 1e6;
        const x = padding + freqNorm * graphWidth;
        ctx.fillText(freqMHz.toFixed(1) + ' MHz', x, height - padding + 10);
    }

    // Draw magnitude axis labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const magSteps = 5;
    for (let i = 0; i <= magSteps; i++) {
        const mag = minMag + (maxMag - minMag) * (i / magSteps);
        const y = height - padding - (i / magSteps) * graphHeight;
        ctx.fillText(mag.toFixed(1) + ' dB', padding - 10, y);
    }

    // Draw labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Frequency (MHz)', width / 2, height - 15);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Magnitude (dB)', 0, 0);
    ctx.restore();
}

function clearFFT() {
    const ctx = elements.fftCanvas.getContext('2d');
    const width = elements.fftCanvas.width;
    const height = elements.fftCanvas.height;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Clear total power display
    elements.fftTotalPowerLinear.textContent = '-';
    elements.fftTotalPowerDb.textContent = '-';
    elements.fftTimedomainPowerLinear.textContent = '-';
    elements.fftTimedomainPowerDb.textContent = '-';
}

function calculateSpectrogram() {
    if (marker1Time === null || marker2Time === null || iqData.sampleCount === 0) {
        clearSpectrogram();
        return;
    }

    const fftSize = 1024;
    const overlapPercent = parseInt(elements.spectrogramOverlapSelector.value);
    spectrogramHopSize = Math.floor(fftSize * (1 - overlapPercent / 100));
    const startSample = msToSample(Math.min(marker1Time, marker2Time));
    const endSample = msToSample(Math.max(marker1Time, marker2Time));
    const duration = endSample - startSample;

    if (duration < fftSize) {
        setStatus('Range too short for spectrogram');
        clearSpectrogram();
        return;
    }

    const samplingRateHz = getSamplingRateMsps() * 1e6;
    const spectrogram = computeSpectrogram(iqData.iValues, iqData.qValues, startSample, endSample, fftSize, spectrogramHopSize);

    drawSpectrogram(spectrogram, samplingRateHz, startSample);
}

function drawSpectrogram(spectrogram, samplingRateHz, startSample = 0) {
    const ctx = elements.spectrogramCanvas.getContext('2d');
    const width = elements.spectrogramCanvas.width;
    const height = elements.spectrogramCanvas.height;
    const colorbarWidth = 18;
    const colorbarGraphGap = 12; // space between heatmap and colorbar
    const colorbarLabelSpace = 40; // space for tick numbers + "dBFS" title
    const padding = { left: 60, right: colorbarGraphGap + colorbarWidth + colorbarLabelSpace, top: 40, bottom: 50 };

    // Check dark mode
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const bgColor = isDarkMode ? '#1e1e1e' : '#ffffff';
    const fgColor = isDarkMode ? '#e0e0e0' : '#000000';

    // Clear canvas
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    const numFrames = spectrogram.length;
    const fftSize = spectrogram[0].length;
    const startSampleMs = sampleToMs(startSample);

    // Find min magnitude across all frames; max is fixed at 0 dBFS (full scale)
    let minMag = 0;
    const maxMag = 0;
    for (let frame = 0; frame < numFrames; frame++) {
        for (let bin = 0; bin < fftSize; bin++) {
            minMag = Math.min(minMag, spectrogram[frame][bin]);
        }
    }

    // Draw spectrogram as heatmap
    const imageData = ctx.createImageData(graphWidth, graphHeight);
    const data = imageData.data;

    // Precompute a color lookup table so the colormap isn't recomputed per pixel
    const lutSize = 256;
    const colorLut = new Uint8ClampedArray(lutSize * 3);
    for (let i = 0; i < lutSize; i++) {
        const [r, g, b] = spectrogramColor(i / (lutSize - 1));
        colorLut[i * 3] = r;
        colorLut[i * 3 + 1] = g;
        colorLut[i * 3 + 2] = b;
    }

    // Precompute the bin index for each x pixel (independent of y/frame)
    const binIdxForX = new Int32Array(graphWidth);
    for (let x = 0; x < graphWidth; x++) {
        const binIdxNorm = x / graphWidth;
        const displayBinIdx = Math.round(binIdxNorm * fftSize);

        let binIdx;
        if (displayBinIdx < fftSize / 2) {
            binIdx = displayBinIdx - fftSize / 2;
            if (binIdx < 0) binIdx += fftSize;
        } else {
            binIdx = displayBinIdx - fftSize / 2;
        }

        binIdxForX[x] = Math.max(0, Math.min(binIdx, fftSize - 1));
    }

    const invRange = 1 / ((maxMag - minMag) || 1);

    // For each pixel position, find and draw the appropriate value
    for (let y = 0; y < graphHeight; y++) {
        // Map y pixel to frame index
        const frameIdx = Math.round((y / graphHeight) * (numFrames - 1));
        const clampedFrameIdx = Math.max(0, Math.min(frameIdx, numFrames - 1));
        const frameSpectrum = spectrogram[clampedFrameIdx];
        let pixelIdx = y * graphWidth * 4;

        for (let x = 0; x < graphWidth; x++) {
            const mag = frameSpectrum[binIdxForX[x]];
            let normalized = (mag - minMag) * invRange;
            if (normalized < 0) normalized = 0;
            else if (normalized > 1) normalized = 1;

            const lutIdx = (normalized * (lutSize - 1)) | 0;
            const lutOffset = lutIdx * 3;

            data[pixelIdx] = colorLut[lutOffset];
            data[pixelIdx + 1] = colorLut[lutOffset + 1];
            data[pixelIdx + 2] = colorLut[lutOffset + 2];
            data[pixelIdx + 3] = 255;
            pixelIdx += 4;
        }
    }

    ctx.putImageData(imageData, padding.left, padding.top);

    // Draw axes
    ctx.strokeStyle = fgColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Draw frequency axis labels
    ctx.fillStyle = fgColor;
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const maxFreq = samplingRateHz / 2;
    const freqSteps = 5;
    for (let i = 0; i <= freqSteps; i++) {
        const freqNorm = i / freqSteps;
        const freq = -maxFreq + freqNorm * (2 * maxFreq);
        const freqMHz = freq / 1e6;
        const x = padding.left + freqNorm * graphWidth;
        ctx.fillText(freqMHz.toFixed(1) + ' MHz', x, height - padding.bottom + 10);
    }

    // Draw time axis labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const samplingRateMsps = getSamplingRateMsps();
    const samplingRateSamplesPerMs = samplingRateMsps * 1e3;
    const timeSteps = 5;
    for (let i = 0; i <= timeSteps; i++) {
        const frameIdx = Math.floor(i * (numFrames - 1) / timeSteps);
        const sampleOffset = frameIdx * spectrogramHopSize;
        const relativeTimeMs = sampleOffset / samplingRateSamplesPerMs;
        const absoluteTimeMs = startSampleMs + relativeTimeMs;
        const y = padding.top + (i / timeSteps) * graphHeight;
        ctx.fillText(absoluteTimeMs.toFixed(3) + ' ms', padding.left - 10, y);
    }

    // Draw labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Frequency (MHz)', width / 2, height - 15);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Time (ms)', 0, 0);
    ctx.restore();

    // Draw color scale (dBFS legend)
    const colorbarX = width - padding.right + colorbarGraphGap;
    const colorbarImage = ctx.createImageData(colorbarWidth, graphHeight);
    const colorbarData = colorbarImage.data;
    for (let y = 0; y < graphHeight; y++) {
        const normalized = 1 - y / (graphHeight - 1 || 1); // top = max, bottom = min
        const [r, g, b] = spectrogramColor(normalized);
        for (let x = 0; x < colorbarWidth; x++) {
            const idx = (y * colorbarWidth + x) * 4;
            colorbarData[idx] = r;
            colorbarData[idx + 1] = g;
            colorbarData[idx + 2] = b;
            colorbarData[idx + 3] = 255;
        }
    }
    ctx.putImageData(colorbarImage, colorbarX, padding.top);

    ctx.strokeStyle = fgColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(colorbarX, padding.top, colorbarWidth, graphHeight);

    ctx.fillStyle = fgColor;
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    const colorbarSteps = 5;
    for (let i = 0; i <= colorbarSteps; i++) {
        const norm = i / colorbarSteps;
        const dbValue = minMag + norm * (maxMag - minMag);
        const y = padding.top + graphHeight - norm * graphHeight;
        ctx.textBaseline = i === 0 ? 'bottom' : (i === colorbarSteps ? 'top' : 'middle');
        ctx.fillText(dbValue.toFixed(0), colorbarX + colorbarWidth + 4, y);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.save();
    ctx.translate(width - 12, padding.top + graphHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('dBFS', 0, 0);
    ctx.restore();
}

function clearSpectrogram() {
    const ctx = elements.spectrogramCanvas.getContext('2d');
    const width = elements.spectrogramCanvas.width;
    const height = elements.spectrogramCanvas.height;
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const bgColor = isDarkMode ? '#1e1e1e' : '#ffffff';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
}

// HSL to RGB conversion utility
// Colormap: black->blue->cyan->green->yellow->red
// Jet colormap: dark blue -> blue -> cyan -> green -> yellow -> red (0=darkest blue, 1=red)
function spectrogramColor(normalized) {
    const t = Math.max(0, Math.min(1, normalized));
    const r = Math.round(255 * clamp01(1.5 - Math.abs(4 * t - 3)));
    const g = Math.round(255 * clamp01(1.5 - Math.abs(4 * t - 2)));
    const b = Math.round(255 * clamp01(1.5 - Math.abs(4 * t - 1)));
    return [r, g, b];
}

function clamp01(x) {
    return Math.max(0, Math.min(1, x));
}


function handleSpectrogramOverlapChange() {
    calculateSpectrogram();
}

function reprocessDataAndUpdateAll() {
    if (iqData.sampleCount === 0) {
        return;
    }

    setStatus('Reprocessing data and updating all views...');
    showProgress();

    setTimeout(() => {
        // 1. Reprocess with current scale and format
        const reprocessscale = elements.scaleSelector.value;
        iqData.reprocessWithScale(reprocessscale);

        // 2. Update UI
        updateUI();

        // 3. Update waveform
        updateWaveform();

        // 4. Recalculate FFT
        calculateFFT();

        // 5. Recalculate Spectrogram
        calculateSpectrogram();

        setStatus('Data reprocessed - All views updated (Waveform, FFT, Spectrogram)');
        hideProgress();
    }, 0);
}

function handleScaleChange(event) {
    reprocessDataAndUpdateAll();
}

function handleSamplingRateChange(event) {
    const newRate = event.target.value;
    updateTimeRange();
    updateTimeSliders();
    reprocessDataAndUpdateAll();
}

function handleIQFormatChange(event) {
    if (iqData.sampleCount === 0) {
        return;
    }

    const newFormat = event.target.value;
    if (!iqData.rawArrayBuffer) {
        setStatus('Error: No raw data to reformat');
        return;
    }

    setStatus(`Reformatting data to ${newFormat} format and updating all views...`);
    showProgress();

    setTimeout(() => {
        // Reload with new format
        const formatscale = elements.scaleSelector.value;
        const fileName = iqData.fileName;
        iqData.loadFromArrayBuffer(iqData.rawArrayBuffer, fileName, newFormat, formatscale);

        // Update all views
        updateUI();
        updateWaveform();
        calculateFFT();
        calculateSpectrogram();

        setStatus(`Data reformatted to ${newFormat} - All views updated (Waveform, FFT, Spectrogram)`);
        hideProgress();
    }, 0);
}

function handleStartTimeSliderChange(event) {
    const startMs = parseFloat(event.target.value);
    elements.startTime.value = startMs;
    elements.startTimeValue.textContent = startMs.toFixed(3);
    updateWaveform();
}

function handleEndTimeSliderChange(event) {
    const endMs = parseFloat(event.target.value);
    elements.endTime.value = endMs;
    elements.endTimeValue.textContent = endMs.toFixed(3);
    updateWaveform();
}

function updateTimeSliders() {
    const totalTimeMs = sampleToMs(iqData.sampleCount - 1);
    elements.startTimeSlider.max = totalTimeMs;
    elements.endTimeSlider.max = totalTimeMs;
}

function handleTimeRangeChange() {
    const startMs = parseFloat(elements.startTime.value) || 0;
    const endMs = parseFloat(elements.endTime.value) || 0;

    elements.startIndex.value = msToSample(startMs);
    elements.endIndex.value = msToSample(endMs);
    updateWaveform();
}

function updateTimeRange() {
    const startSample = parseInt(elements.startIndex.value) || 0;
    const endSample = parseInt(elements.endIndex.value) || iqData.sampleCount;

    elements.startTime.value = sampleToMs(startSample).toFixed(3);
    elements.endTime.value = sampleToMs(endSample).toFixed(3);
}

function handleAmplitudeUnitChange(event) {
    if (iqData.sampleCount === 0) {
        return;
    }

    const newUnit = event.target.value;
    updateWaveform();
    setStatus(`Amplitude unit changed to: ${newUnit}`);
}

function setStatus(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;

    // Append message to log
    if (elements.statusLog.value) {
        elements.statusLog.value += '\n' + logMessage;
    } else {
        elements.statusLog.value = logMessage;
    }

    // Auto-scroll to bottom
    elements.statusLog.scrollTop = elements.statusLog.scrollHeight;
}

function showProgress() {
    elements.progress.style.display = 'flex';
    elements.progressFill.style.width = '50%';
}

function hideProgress() {
    elements.progress.style.display = 'none';
    elements.progressFill.style.width = '0%';
}

function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

// Test functions
function handleWaveformTypeChange() {
    const waveformType = document.getElementById('testWaveformType').value;
    const cwParamsDiv = document.getElementById('cwParamsDiv');
    const chirpParamsDiv = document.getElementById('chirpParamsDiv');  //TEST

    if (waveformType === 'cw') {
        cwParamsDiv.style.display = 'block';
        chirpParamsDiv.style.display = 'none';
    } else if (waveformType === 'chirp') {
        cwParamsDiv.style.display = 'none';
        chirpParamsDiv.style.display = 'block';
    }
}

function generateTestData() {
    try {
        const waveformType = document.getElementById('testWaveformType').value;
        const durationMs = parseFloat(document.getElementById('testDurationInput').value) || 1000;
        const samplingRateMsps = getSamplingRateMsps();

        let arrayBuffer;
        let dataFileName;
        let statusMsg;

        if (waveformType === 'cw') {
            const frequencyMHz = parseFloat(document.getElementById('testFreqInput').value) || 15;
            statusMsg = `Generating Vector CW ${frequencyMHz>0?'+':''}${frequencyMHz}MHz (${durationMs}ms, ${samplingRateMsps}Msps)...`;
            setStatus(statusMsg);
            arrayBuffer = generateVectorCWArrayBuffer(frequencyMHz, durationMs, samplingRateMsps);
            dataFileName = `Vector_CW_${frequencyMHz}MHz_${durationMs}ms.bin`;
        } else if (waveformType === 'chirp') {
            const sweepVelocityMHzPerMs = parseFloat(document.getElementById('testChirpVelocity').value) || 0.05;
            const startFreqMHz = 0;
            const endFreqMHz = startFreqMHz + sweepVelocityMHzPerMs * durationMs;
            statusMsg = `Generating Chirp sweep 0→${endFreqMHz.toFixed(1)}MHz (${sweepVelocityMHzPerMs}MHz/ms, ${durationMs}ms, ${samplingRateMsps}Msps)...`;
            setStatus(statusMsg);
            arrayBuffer = generateChirpArrayBuffer(startFreqMHz, sweepVelocityMHzPerMs, durationMs, samplingRateMsps);
            dataFileName = `Chirp_${sweepVelocityMHzPerMs}MHzPerMs_${durationMs}ms.bin`;
        } else {
            setStatus('Invalid waveform type');
            return;
        }

        // Generate test data
        let testiqFormat = elements.iqFormatSelector.value;
        let testscale = elements.scaleSelector.value;

        // Load test data
        iqData.loadFromArrayBuffer(arrayBuffer, dataFileName, testiqFormat, testscale);

        updateUI();

        // Update Display Range sliders
        updateTimeRange();
        updateTimeSliders();
        elements.startTimeSlider.value = 0;
        elements.endTimeSlider.value = sampleToMs(iqData.sampleCount - 1);
        elements.startTimeValue.textContent = '0.000';
        elements.endTimeValue.textContent = sampleToMs(iqData.sampleCount - 1).toFixed(3);
        elements.zoomSlider.value = 100;
        elements.zoomValue.textContent = '100';

        updateWaveform();

        // Set default markers (same as file load)
        const totalTimeMs = sampleToMs(iqData.sampleCount - 1);
        marker1Time = 0;
        marker1Amplitude = iqData.amplitudes[0];
        marker2Time = totalTimeMs;
        marker2Amplitude = iqData.amplitudes[iqData.sampleCount - 1];

        // Update marker display
        elements.marker1Value.textContent = `${marker1Time.toFixed(3)} ms (${iqData.convertAmplitudeToDb(marker1Amplitude).toFixed(2)} dB)`;
        elements.marker2Value.textContent = `${marker2Time.toFixed(3)} ms (${iqData.convertAmplitudeToDb(marker2Amplitude).toFixed(2)} dB)`;

        // Calculate FFT and Spectrogram
        updateBurstLength();
        calculateFFT();
        calculateSpectrogram();

        setStatus(`Test data loaded: ${dataFileName}, ${iqData.sampleCount} samples - Markers set, FFT & Spectrogram calculated`);
        document.getElementById('testResults').style.display = 'none';
    } catch (error) {
        setStatus(`Error generating test data: ${error.message}`);
        console.error('Test data generation error:', error);
    }
}

function runVectorCWTest() {
    try {
        if (iqData.sampleCount === 0) {
            setStatus('No data loaded. Please generate test data first.');
            return;
        }

        setStatus('Running Vector CW Test...');
        const frequencyMHz = parseFloat(document.getElementById('testFreqInput').value) || 15;
        const samplingRateMsps = getSamplingRateMsps();

        // Prepare results
        let resultsText = '';
        let allPassed = true;

        // 1. Validate Waveform
        setStatus('Running Vector CW Test - Validating waveform...');
        const waveformResult = validateWaveformData(iqData.iValues, iqData.qValues, frequencyMHz);
        resultsText += `Waveform Data Validation:\n`;
        resultsText += `  Status: ${waveformResult.passed ? 'PASSED' : 'FAILED'}\n`;
        resultsText += `  IQ Amplitude: ${waveformResult.iqAmplitude.toFixed(4)} (expected ${waveformResult.expectedAmplitude.toFixed(4)})\n`;
        resultsText += `  I RMS: ${waveformResult.iRMS.toFixed(4)}, Q RMS: ${waveformResult.qRMS.toFixed(4)}\n`;
        resultsText += `  Data Valid: ${waveformResult.dataValid}\n\n`;
        allPassed = allPassed && waveformResult.passed;

        // 2. Validate FFT Peak
        setStatus('Running Vector CW Test - Validating FFT...');
        const fftResult = validateFFTPeak(iqData.iValues, iqData.qValues, frequencyMHz, 0.5, samplingRateMsps);
        resultsText += `FFT Peak Validation:\n`;
        resultsText += `  Status: ${fftResult.passed ? 'PASSED' : 'FAILED'}\n`;
        resultsText += `  Expected: ${fftResult.expectedFreqMHz.toFixed(2)} MHz\n`;
        resultsText += `  Detected: ${fftResult.detectedPeakMHz.toFixed(2)} MHz\n`;
        resultsText += `  Difference: ${fftResult.freqDiffMHz.toFixed(3)} MHz\n`;
        resultsText += `  Tolerance: ±${fftResult.toleranceMHz.toFixed(2)} MHz\n`;
        resultsText += `  Peak Magnitude: ${fftResult.peakMagnitudeDb.toFixed(2)} dB\n\n`;
        allPassed = allPassed && fftResult.passed;

        // 3. Validate Spectrogram (if markers are set)
        if (marker1Time !== null && marker2Time !== null) {
            setStatus('Running Vector CW Test - Validating spectrogram...');

            // Calculate spectrogram for markers
            const startSample = msToSample(Math.min(marker1Time, marker2Time));
            const endSample = msToSample(Math.max(marker1Time, marker2Time));
            const hopSize = 1024;
            const fftSize = 1024;
            const numFrames = Math.floor((endSample - startSample - fftSize) / hopSize) + 1;

            if (numFrames > 0) {
                const spectrogram = computeSpectrogram(iqData.iValues, iqData.qValues, startSample, endSample, fftSize, hopSize);
                const spectroResult = validateSpectrogramEnergy(spectrogram, frequencyMHz, 0.5, samplingRateMsps);
                resultsText += `Spectrogram Energy Validation:\n`;
                resultsText += `  Status: ${spectroResult.passed ? 'PASSED' : 'FAILED'}\n`;
                resultsText += `  Expected: ${spectroResult.expectedFreqMHz.toFixed(2)} MHz\n`;
                resultsText += `  Max Energy Freq: ${spectroResult.maxEnergyFreq.toFixed(2)} MHz\n`;
                resultsText += `  Difference: ${spectroResult.freqDiffMHz.toFixed(3)} MHz\n`;
                resultsText += `  Max Energy: ${spectroResult.maxEnergy.toFixed(2)}\n\n`;
                allPassed = allPassed && spectroResult.passed;
            } else {
                resultsText += `Spectrogram Energy Validation:\n  Status: SKIPPED (insufficient marker range)\n\n`;
            }
        } else {
            resultsText += `Spectrogram Energy Validation:\n  Status: SKIPPED (set Marker 1 and 2 to enable)\n\n`;
        }

        // Final result
        resultsText += `=====================================\n`;
        resultsText += `OVERALL RESULT: ${allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}\n`;
        resultsText += `=====================================`;

        // Display results
        const resultsDiv = document.getElementById('testResults');
        const resultsContent = document.getElementById('testResultsContent');
        resultsContent.textContent = resultsText;
        resultsDiv.style.display = 'block';

        setStatus(`Vector CW Test completed: ${allPassed ? 'PASSED' : 'FAILED'}`);
    } catch (error) {
        setStatus(`Test error: ${error.message}`);
        console.error('Test error:', error);
    }
}

document.addEventListener('DOMContentLoaded', init);
