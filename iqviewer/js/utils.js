// Utility Functions for IQ Data Viewer

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

function formatNumber(num) {
    return num.toLocaleString();
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function calculateAmplitude(i, q) {
    return Math.sqrt(i * i + q * q);
}

function findMinMax(values) {
    if (values.length === 0) {
        return { min: 0, max: 0 };
    }
    let min = values[0];
    let max = values[0];
    for (let i = 1; i < values.length; i++) {
        if (values[i] < min) min = values[i];
        if (values[i] > max) max = values[i];
    }
    return { min, max };
}

function downsampleMinMax(values, targetSize) {
    if (values.length <= targetSize) {
        return values;
    }

    const result = [];
    const itemsPerBucket = Math.ceil(values.length / targetSize);

    for (let i = 0; i < targetSize; i++) {
        const start = i * itemsPerBucket;
        const end = Math.min((i + 1) * itemsPerBucket, values.length);
        const bucket = values.slice(start, end);
        const { min, max } = findMinMax(bucket);
        result.push((min + max) / 2);
    }

    return result;
}
