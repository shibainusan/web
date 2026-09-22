// Simple FFT implementation (Cooley-Tukey algorithm)
class FFT {
    constructor(size) {
        this.size = size;
        this.bit_reverse = this.makeBitReverse(size);
    }

    makeBitReverse(size) {
        const result = new Array(size);
        for (let i = 0; i < size; i++) {
            let reversed = 0;
            let n = i;
            let bits = Math.log2(size);
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

        // Bit reversal
        for (let i = 0; i < N; i++) {
            const rev = this.bit_reverse[i];
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

        // FFT computation
        for (let s = 1; s <= Math.log2(N); s++) {
            const m = 1 << s;
            const m2 = m >> 1;
            const w_real = Math.cos(-2 * Math.PI / m);
            const w_imag = Math.sin(-2 * Math.PI / m);

            for (let k = 0; k < N; k += m) {
                let wm_real = 1;
                let wm_imag = 0;

                for (let j = 0; j < m2; j++) {
                    const t_idx = 2 * (k + j + m2);
                    const u_idx = 2 * (k + j);

                    // t = wm * output[k + j + m2]
                    const t_real = wm_real * output[t_idx] - wm_imag * output[t_idx + 1];
                    const t_imag = wm_real * output[t_idx + 1] + wm_imag * output[t_idx];

                    // output[k + j + m2] = output[k + j] - t
                    output[t_idx] = output[u_idx] - t_real;
                    output[t_idx + 1] = output[u_idx + 1] - t_imag;

                    // output[k + j] = output[k + j] + t
                    output[u_idx] += t_real;
                    output[u_idx + 1] += t_imag;

                    // wm = wm * w
                    const temp_real = wm_real * w_real - wm_imag * w_imag;
                    wm_imag = wm_real * w_imag + wm_imag * w_real;
                    wm_real = temp_real;
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
