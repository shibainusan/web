// File Loader Test - Load real binary file

async function testFileLoading() {
    console.log('Starting file loading test...');

    try {
        const response = await fetch('URF_6G_TM31_RXStream1.bin');
        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            return;
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log(`File loaded: ${formatFileSize(arrayBuffer.byteLength)}`);

        const iqData = new IQData();
        const metadata = await iqData.loadFromArrayBuffer(arrayBuffer, 'URF_6G_TM31_RXStream1.bin');

        console.log(`Loaded IQ pairs: ${formatNumber(metadata.sampleCount)}`);
        console.log(`Min amplitude: ${metadata.minAmplitude.toFixed(4)}`);
        console.log(`Max amplitude: ${metadata.maxAmplitude.toFixed(4)}`);

        // Test renderer
        const canvas = document.getElementById('waveformCanvas');
        if (canvas) {
            const renderer = new WaveformRenderer(canvas);
            const displayData = iqData.getAmplitudeDataDownsampled(0, Math.min(100000, metadata.sampleCount), canvas.width);
            const stats = iqData.getStatistics();
            renderer.render(displayData.data, stats.min, stats.max, 0, displayData.endIndex);
            console.log('Canvas rendering test successful');
        }

    } catch (error) {
        console.error('File loading test failed:', error);
    }
}

// Run test automatically when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', testFileLoading);
} else {
    testFileLoading();
}
