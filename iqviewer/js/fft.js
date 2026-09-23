// Simple FFT implementation (Cooley-Tukey algorithm)
class FFT {
    constructor(size) {
        this.size = size;
        this.numStages = Math.log2(size);
        this.bit_reverse = this.makeBitReverse(size);
        // Precompute the N/2 twiddle factors once; every stage indexes into
        // this same table with a stage-dependent stride instead of
        // recomputing sin/cos or iteratively rotating a complex number
        // on every transform() call.
        const half = size >> 1;
        this.cosTable = new Float64Array(half);
        this.sinTable = new Float64Array(half);
        for (let k = 0; k < half; k++) {
            const angle = -2 * Math.PI * k / size;
            this.cosTable[k] = Math.cos(angle);
            this.sinTable[k] = Math.sin(angle);
        }
    }

    makeBitReverse(size) {
        const result = new Int32Array(size);
        const bits = Math.log2(size);
        for (let i = 0; i < size; i++) {
            let reversed = 0;
            let n = i;
            for (let j = 0; j < bits; j++) {
                reversed = (reversed << 1) | (n & 1);
                n >>= 1;
            }
            result[i] = reversed;
        }
        return result;
    }

    // In-place FFT of interleaved complex data [re0, im0, re1, im1, ...]
    transform(output) {
        const N = this.size;
        const bitReverse = this.bit_reverse;

        // Bit reversal
        for (let i = 0; i < N; i++) {
            const rev = bitReverse[i];
            if (i < rev) {
                // Swap
                const temp_real = output[2 * i];
                const temp_imag = output[2 * i + 1];
                output[2 * i] = output[2 * rev];
                output[2 * i + 1] = output[2 * rev + 1];
                output[2 * rev] = temp_real;
                output[2 * rev + 1] = temp_imag;
            }
        }

        const cosTable = this.cosTable;
        const sinTable = this.sinTable;

        // FFT computation
        for (let s = 1; s <= this.numStages; s++) {
            const m = 1 << s;
            const m2 = m >> 1;
            const stride = N / m;

            for (let k = 0; k < N; k += m) {
                let twIdx = 0;
                for (let j = 0; j < m2; j++) {
                    const t_idx = 2 * (k + j + m2);
                    const u_idx = 2 * (k + j);

                    const wm_real = cosTable[twIdx];
                    const wm_imag = sinTable[twIdx];

                    // t = wm * output[k + j + m2]
                    const t_real = wm_real * output[t_idx] - wm_imag * output[t_idx + 1];
                    const t_imag = wm_real * output[t_idx + 1] + wm_imag * output[t_idx];

                    // output[k + j + m2] = output[k + j] - t
                    output[t_idx] = output[u_idx] - t_real;
                    output[t_idx + 1] = output[u_idx + 1] - t_imag;

                    // output[k + j] = output[k + j] + t
                    output[u_idx] += t_real;
                    output[u_idx + 1] += t_imag;

                    twIdx += stride;
                }
            }
        }
    }

    createComplexArray() {
        return new Float32Array(this.size * 2);
    }

    fromComplexArray(complex, out) {
        for (let i = 0; i < complex.length; i++) {
            out[i] = complex[i];
        }
    }
}
