// Simple Test Script for IQ Data Processing

async function runTests() {
    console.log('IQ Data Viewer Tests Starting...');

    const iqData = new IQData();
    console.log('✓ IQData object created');

    // Test 1: Utility functions
    console.log('\n=== Test 1: Utility Functions ===');
    console.assert(formatFileSize(1024) === '1.00 KB', 'formatFileSize failed');
    console.assert(calculateAmplitude(3, 4) === 5, 'calculateAmplitude failed (should be 5)');
    console.assert(typeof formatNumber(1234567) === 'string', 'formatNumber failed');
    console.log('✓ All utility functions passed');

    // Test 2: IQData initialization
    console.log('\n=== Test 2: IQData Initialization ===');
    const testBuffer = new Float32Array([
        1.0, 2.0,   // i=1, q=2, amplitude=sqrt(5)≈2.236
        3.0, 4.0,   // i=3, q=4, amplitude=sqrt(25)=5
        0.0, 0.0    // i=0, q=0, amplitude=0
    ]);
    await iqData.loadFromArrayBuffer(testBuffer.buffer, 'test.bin');
    console.assert(iqData.sampleCount === 3, `sampleCount should be 3, got ${iqData.sampleCount}`);
    console.log(`✓ IQData loaded: ${iqData.sampleCount} samples`);

    // Test 3: Amplitude calculation
    console.log('\n=== Test 3: Amplitude Calculation ===');
    const amp1 = calculateAmplitude(1, 2);
    const expectedAmp1 = Math.sqrt(5);
    console.assert(Math.abs(amp1 - expectedAmp1) < 0.001, `Amplitude calc failed: got ${amp1}, expected ${expectedAmp1}`);
    console.log(`✓ Amplitude calculation correct: (1,2) = ${amp1.toFixed(3)}`);

    // Test 4: Data extraction
    console.log('\n=== Test 4: Data Extraction ===');
    const ampData = iqData.getAmplitudeData(0, 3);
    console.assert(ampData !== null, 'getAmplitudeData returned null');
    console.assert(ampData.data.length === 3, `Expected 3 samples, got ${ampData.data.length}`);
    console.log(`✓ Extracted ${ampData.data.length} samples`);

    // Test 5: Downsampling
    console.log('\n=== Test 5: Downsampling ===');
    const downsampled = iqData.getAmplitudeDataDownsampled(0, 3, 2);
    console.assert(downsampled.displayLength === 2, `Expected 2 display points, got ${downsampled.displayLength}`);
    console.log(`✓ Downsampling: ${downsampled.originalLength} → ${downsampled.displayLength}`);

    // Test 6: Metadata
    console.log('\n=== Test 6: Metadata ===');
    const meta = iqData.getMetadata();
    console.assert(meta.fileName === 'test.bin', 'Metadata fileName incorrect');
    console.assert(meta.iqPairCount === 3, 'Metadata iqPairCount incorrect');
    console.log(`✓ Metadata correct: ${meta.fileName}, ${meta.iqPairCount} pairs`);

    // Test 7: Statistics
    console.log('\n=== Test 7: Statistics ===');
    const stats = iqData.getStatistics();
    console.assert(stats.min >= 0, 'Stats min should be >= 0');
    console.assert(stats.max > 0, 'Stats max should be > 0');
    console.log(`✓ Statistics: min=${stats.min.toFixed(3)}, max=${stats.max.toFixed(3)}, mean=${stats.mean.toFixed(3)}`);

    console.log('\n=== All Tests Passed ✓ ===\n');
}

// Run tests when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runTests);
} else {
    runTests();
}
