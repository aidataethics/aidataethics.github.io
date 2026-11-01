// LFM3-Omni-2B in the browser: text, images and speech in; text and speech out.
//
// Used by tools/omni-worker.js (the Multimodal Sandbox runs it in a worker so
// the page stays responsive). Everything happens on this computer: images and
// recordings are turned into numbers here and never sent anywhere. The only
// network traffic is the one-off download of the model files from Hugging
// Face, which are then kept in the browser's private file system for this site,
// and onnxruntime-web and the tokenizer library, which load from jsdelivr like
// the LLM Sandbox's (an ES module that pulls in WASM at runtime cannot be
// vendored as one file).
//
// Model: LiquidAI/LFM3-Omni-2B-ONNX, pinned to a revision so a course run in a
// later year gets the same weights. On WebGPU the model card pairs the q4f16
// decoder with the float32 side graphs of the q4 bundle:
//   decoder_q4f16      1.41 GB  text and speech-frame steps, caches in fp16
//   vision_encoder_q8  0.20 GB  image patches -> image features
//   audio_encoder      0.51 GB  log-mel of 16 kHz speech -> audio features
//   depth_decoder      0.34 GB  decoder state -> the 12 codes of a speech frame
//   codec_decoder      0.18 GB  codes -> STFT frames -> 24 kHz audio
// The decoder loads first; each side graph loads the first time it is needed.
//
// The generation logic is a port of LiquidONNX (github.com/Liquid4All/onnx-export,
// src/liquidonnx/lfm3_audio/session.py and lfm3_vl/session.py), Copyright Liquid
// AI, under the LFM Open License v1.0, which also covers the model. Changes from
// it: JavaScript instead of numpy, batch 1 only, the image resize is the
// browser's high-quality canvas scaling rather than PIL bicubic, and recordings
// are resampled to 16 kHz by the browser rather than by scipy.

import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/ort.webgpu.bundle.min.mjs';
// Tokenizer and chat template only. 4.3.2 rather than the 4.2.0 the LLM
// Sandbox pins: the LFM3 tokenizer needs the newer release.
import { AutoTokenizer } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';
// ORT warns that shape ops run on the CPU, which it does on purpose; keep the
// console for real errors.
ort.env.logLevel = 'error';

export const MODEL_REPO = 'LiquidAI/LFM3-Omni-2B-ONNX';
export const MODEL_REVISION = '7d6bd3fd59a0622e5ce7fefc141145a8bba1435a';
const BASE = `https://huggingface.co/${MODEL_REPO}/resolve/${MODEL_REVISION}/`;
const CACHE_NAME = 'omni-weights-' + MODEL_REVISION.slice(0, 8);

export const PARTS = {
    decoder: { file: 'decoder_q4f16', mb: 1413, label: 'language model' },
    vision: { file: 'vision_encoder_q8', mb: 196, label: 'image encoder' },
    audio: { file: 'audio_encoder', mb: 510, label: 'speech encoder' },
    depth: { file: 'depth_decoder', mb: 336, label: 'speech frame decoder' },
    codec: { file: 'codec_decoder', mb: 179, label: 'voice codec' },
};

// config.json of the model
const T = {
    eos: 124900,            // <|im_end|>
    textEnd: 125014,        // <|text_end|>
    audioStart: 125012,     // <|audio_start|>
    mixedStart: 125015,     // <|mixed_start|>
    image: 125030,
    video: 125029,
    audio: 125031,
    audioOut: 125032,
};
const HIDDEN = 2048;
const CODEBOOKS = 12;
const AUDIO_EOS = 2016;
const MASKGIT = [4, 4, 4];
const INTERLEAVED_TEXT = 6, INTERLEAVED_AUDIO = 12;
const PREFILL_CHUNK = 1024;   // the model card's limit on WebGPU
// generation_config.json: greedy text; speech codes sampled
const AUDIO_SAMPLING = { temperature: 0.4, repetitionPenalty: 1.2, window: 64 };

// ------------------------------------------------------------- downloads

// Fetch a file once and keep it in the origin's private file system (OPFS).
// Cache Storage refuses entries of a few hundred megabytes, and Hugging Face
// redirects to signed CDN URLs, so the ordinary HTTP cache misses every visit.
// A writable commits only on close(), so an interrupted download leaves no
// half-written file behind.
async function weightsDir() {
    try {
        const root = await navigator.storage.getDirectory();
        return await root.getDirectoryHandle(CACHE_NAME, { create: true });
    } catch (e) { return null; }   // private window, or storage blocked
}

async function fetchCached(url, onBytes) {
    const name = url.split('/').pop();
    const dir = await weightsDir();
    if (dir) {
        try {
            const file = await (await dir.getFileHandle(name)).getFile();
            if (file.size > 0) {
                onBytes?.(file.size, file.size, true);
                return new Uint8Array(await file.arrayBuffer());
            }
        } catch (e) { /* not downloaded yet */ }
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed (${res.status}): ${name}`);
    const total = +res.headers.get('content-length') || 0;
    let writable = null;
    if (dir) {
        try { writable = await (await dir.getFileHandle(name, { create: true })).createWritable(); }
        catch (e) { writable = null; }
    }
    const reader = res.body.getReader();
    const out = total ? new Uint8Array(total) : null;
    const parts = [];
    let got = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (out) out.set(value, got); else parts.push(value);
            if (writable) await writable.write(value);
            got += value.length;
            onBytes?.(got, total || got, false);
        }
        await writable?.close();
    } catch (e) {
        await writable?.abort().catch(() => {});
        throw e;
    }
    if (out) return out;
    const all = new Uint8Array(got);
    let o = 0;
    for (const p of parts) { all.set(p, o); o += p.length; }
    return all;
}

export async function cachedParts() {
    const dir = await weightsDir();
    if (!dir) return [];
    const have = new Set();
    for await (const [name, handle] of dir.entries()) {
        if (handle.kind === 'file' && (await handle.getFile()).size > 0) have.add(name);
    }
    return Object.keys(PARTS).filter(k => have.has(PARTS[k].file + '.onnx_data'));
}

// Delete every downloaded model file.
export async function clearDownloads() {
    try { await (await navigator.storage.getDirectory()).removeEntry(CACHE_NAME, { recursive: true }); }
    catch (e) { /* nothing stored */ }
}

// --------------------------------------------------------------- helpers

const i64 = a => BigInt64Array.from(a, BigInt);
const tensor = (type, data, dims) => new ort.Tensor(type, data, dims);
const noRows = cols => tensor('float32', new Float32Array(0), [0, cols]);
const noCodes = () => tensor('int64', new BigInt64Array(0), [0, CODEBOOKS]);

function argmax(a, from = 0, to = a.length) {
    let best = from;
    for (let i = from + 1; i < to; i++) if (a[i] > a[best]) best = i;
    return best;
}

function sampleCode(logits, history) {
    // repetition penalty over this codebook's recent codes, then temperature
    const s = Float64Array.from(logits);
    if (history) for (const c of new Set(history)) s[c] = s[c] < 0 ? s[c] * AUDIO_SAMPLING.repetitionPenalty : s[c] / AUDIO_SAMPLING.repetitionPenalty;
    let max = -Infinity;
    for (let i = 0; i < s.length; i++) { s[i] /= AUDIO_SAMPLING.temperature; if (s[i] > max) max = s[i]; }
    let sum = 0;
    for (let i = 0; i < s.length; i++) { s[i] = Math.exp(s[i] - max); sum += s[i]; }
    let r = Math.random() * sum;
    for (let i = 0; i < s.length; i++) { r -= s[i]; if (r <= 0) return i; }
    return s.length - 1;
}

function shuffled(n) {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
}

// ---------------------------------------------------------------- images

// Qwen2-VL smart resize: sides multiples of patch x merge (32 px), pixel count
// within [minPixels, maxPixels]. maxTokens caps one image's share of the prompt.
export function imageSize(w, h, maxTokens = 256) {
    const f = 32, minPx = 64 * f * f, maxPx = maxTokens * f * f;
    let hb = Math.max(f, Math.round(h / f) * f), wb = Math.max(f, Math.round(w / f) * f);
    if (hb * wb > maxPx) {
        const beta = Math.sqrt((h * w) / maxPx);
        hb = Math.max(f, Math.floor(h / beta / f) * f); wb = Math.max(f, Math.floor(w / beta / f) * f);
    } else if (hb * wb < minPx) {
        const beta = Math.sqrt(minPx / (h * w));
        hb = Math.ceil(h * beta / f) * f; wb = Math.ceil(w * beta / f) * f;
    }
    return { width: wb, height: hb };
}

// RGBA pixels [height x width] -> the vision encoder's input
// [gh/2, gw/2, 2, 2, 1536]: one row per 16x16 patch, patches in 2x2 blocks,
// each row channel-major, the frame duplicated over the temporal pair.
export function patchify(rgba, width, height) {
    const P = 16, M = 2, gh = height / P, gw = width / P, D = 3 * 2 * P * P;
    const out = new Float32Array(gh * gw * D);
    let row = 0;
    for (let bh = 0; bh < gh / M; bh++) for (let bw = 0; bw < gw / M; bw++)
        for (let i = 0; i < M; i++) for (let j = 0; j < M; j++) {
            const py0 = (bh * M + i) * P, px0 = (bw * M + j) * P;
            let o = row * D;
            for (let c = 0; c < 3; c++) for (let t = 0; t < 2; t++)
                for (let y = 0; y < P; y++) for (let x = 0; x < P; x++)
                    out[o++] = rgba[((py0 + y) * width + px0 + x) * 4 + c] / 127.5 - 1;
            row++;
        }
    return { data: out, dims: [gh / M, gw / M, M, M, D], tokens: (gh * gw) / (M * M) };
}

// ----------------------------------------------------------------- audio

const N_FFT = 400, HOP = 160, MELS = 128, SR = 16000;
let melTables = null;

// Slaney-scale mel filters with Slaney normalisation, 0-8000 Hz, as
// transformers.audio_utils.mel_filter_bank builds them: [201 bins][128 mels]
function melFilters() {
    const bins = N_FFT / 2 + 1;
    const toMel = f => f < 1000 ? 3 * f / 200 : 15 + Math.log(f / 1000) * 27 / Math.log(6.4);
    const toHz = m => m < 15 ? 200 * m / 3 : 1000 * Math.exp(Math.log(6.4) * (m - 15) / 27);
    const lo = toMel(0), hi = toMel(SR / 2);
    const hz = Array.from({ length: MELS + 2 }, (_, i) => toHz(lo + (hi - lo) * i / (MELS + 1)));
    const fb = new Float32Array(bins * MELS);
    for (let b = 0; b < bins; b++) {
        const f = (SR / 2) * b / (bins - 1);
        for (let m = 0; m < MELS; m++) {
            const down = (f - hz[m]) / (hz[m + 1] - hz[m]);
            const up = (hz[m + 2] - f) / (hz[m + 2] - hz[m + 1]);
            fb[b * MELS + m] = Math.max(0, Math.min(down, up)) * 2 / (hz[m + 2] - hz[m]);
        }
    }
    return fb;
}

function stftTables(n, bins) {
    const cos = new Float32Array(bins * n), sin = new Float32Array(bins * n);
    for (let k = 0; k < bins; k++) for (let t = 0; t < n; t++) {
        const a = 2 * Math.PI * k * t / n;
        cos[k * n + t] = Math.cos(a); sin[k * n + t] = Math.sin(a);
    }
    return { cos, sin };
}

export function melFrames(samples) {
    const padded = Math.max(N_FFT, samples + (((-(samples - N_FFT)) % HOP) + HOP) % HOP);
    return 1 + Math.floor((padded - N_FFT) / HOP);
}
export const audioTokens = frames => Math.ceil(frames / 8);

// Log-mel features [128, frames] of 16 kHz mono samples: power spectrum
// (periodic Hann, no centring), mel filters, log10 floored at -12, (x + 4) / 4.
export function logMel(wave) {
    if (!melTables) melTables = { fb: melFilters(), ...stftTables(N_FFT, N_FFT / 2 + 1) };
    const { fb, cos, sin } = melTables;
    const bins = N_FFT / 2 + 1, frames = melFrames(wave.length);
    const win = Float32Array.from({ length: N_FFT }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N_FFT));
    const out = new Float32Array(MELS * frames);
    const seg = new Float64Array(N_FFT), power = new Float64Array(bins);
    for (let f = 0; f < frames; f++) {
        for (let t = 0; t < N_FFT; t++) { const i = f * HOP + t; seg[t] = (i < wave.length ? wave[i] : 0) * win[t]; }
        for (let k = 0; k < bins; k++) {
            let re = 0, im = 0;
            const o = k * N_FFT;
            for (let t = 0; t < N_FFT; t++) { re += seg[t] * cos[o + t]; im -= seg[t] * sin[o + t]; }
            power[k] = re * re + im * im;
        }
        for (let m = 0; m < MELS; m++) {
            let e = 0;
            for (let k = 0; k < bins; k++) e += fb[k * MELS + m] * power[k];
            out[m * frames + f] = (Math.max(Math.log10(e), -12) + 4) / 4;
        }
    }
    return { data: out, frames };
}

// ------------------------------------------------------------ speech out

const C_FFT = 1280, C_HOP = 320;
let istftTables = null;

// 24 kHz samples of the codec's STFT features [rows, 1282] (log-magnitude,
// then phase): inverse real DFT, periodic Hann, overlap-add, window-squared
// envelope, (n_fft - hop) / 2 trimmed at each end.
export function stftToWave(feat, rows) {
    const bins = C_FFT / 2 + 1;
    if (!istftTables) istftTables = stftTables(C_FFT, bins);
    const { cos, sin } = istftTables;
    const win = Float32Array.from({ length: C_FFT }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / C_FFT));
    const size = (rows - 1) * C_HOP + C_FFT;
    const wave = new Float64Array(size), env = new Float64Array(size);
    const re = new Float64Array(bins), im = new Float64Array(bins), frame = new Float64Array(C_FFT);
    for (let r = 0; r < rows; r++) {
        const o = r * (C_FFT + 2);
        for (let k = 0; k < bins; k++) {
            const mag = Math.exp(feat[o + k]), ph = feat[o + bins + k];
            re[k] = mag * Math.cos(ph); im[k] = mag * Math.sin(ph);
        }
        // irfft: the imaginary parts of DC and Nyquist are ignored
        frame.fill(0);
        for (let k = 0; k < bins; k++) {
            const scale = (k === 0 || k === bins - 1) ? 1 : 2;
            const a = re[k] * scale, b = (k === 0 || k === bins - 1) ? 0 : im[k] * scale;
            const ko = k * C_FFT;
            for (let t = 0; t < C_FFT; t++) frame[t] += a * cos[ko + t] - b * sin[ko + t];
        }
        for (let t = 0; t < C_FFT; t++) {
            wave[r * C_HOP + t] += frame[t] / C_FFT * win[t];
            env[r * C_HOP + t] += win[t] * win[t];
        }
    }
    const pad = (C_FFT - C_HOP) / 2, n = size - 2 * pad;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = wave[i + pad] / env[i + pad];
    return out;
}

// ----------------------------------------------------------------- model

export class OmniModel {
    constructor({ onProgress } = {}) {
        this.onProgress = onProgress;
        this.sessions = {};
        this.loading = {};
        this.stopped = false;
    }

    static async checkDevice() {
        if (!navigator.gpu) return 'This browser has no WebGPU. Use a recent Chrome or Edge on a laptop or desktop.';
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) return 'WebGPU is switched off or unavailable on this device.';
        if (!adapter.features.has('shader-f16')) return 'This GPU lacks 16-bit shader support (shader-f16), which this model needs.';
        return null;
    }

    async loadTokenizer() {
        if (this.tokenizer) return;
        this.tokenizer = await AutoTokenizer.from_pretrained(MODEL_REPO, { revision: MODEL_REVISION });
        this.template = new TextDecoder().decode(await fetchCached(BASE + 'chat_template.jinja'));
    }

    // Load one part (decoder, vision, audio, depth, codec) once.
    load(part) {
        if (this.sessions[part]) return Promise.resolve(this.sessions[part]);
        if (!this.loading[part]) this.loading[part] = (async () => {
            const { file } = PARTS[part];
            const report = (got, total, cached) => this.onProgress?.({ part, got, total, cached });
            const graph = await fetchCached(BASE + 'onnx/' + file + '.onnx');
            let data = await fetchCached(BASE + 'onnx/' + file + '.onnx_data', report);
            this.onProgress?.({ part, compiling: true });
            const options = { executionProviders: ['webgpu'], logSeverityLevel: 3, externalData: [{ path: file + '.onnx_data', data }] };
            // the decoder's outputs stay on the GPU, so its caches never leave
            // it between steps; step() downloads only the logits and hidden state
            if (part === 'decoder') options.preferredOutputLocation = 'gpu-buffer';
            const session = await ort.InferenceSession.create(graph, options);
            data = null;
            this.sessions[part] = session;
            this.onProgress?.({ part, ready: true });
            return session;
        })();
        return this.loading[part];
    }

    // ---- prompt

    // Chat messages -> token ids, each <|image|> and <|audio|> expanded to its
    // feature rows. prefill: tokens appended after the generation prompt.
    promptIds(messages, imageTokens, audioTokenCounts, prefill = []) {
        const text = this.tokenizer.apply_chat_template(messages, {
            tokenize: false, add_generation_prompt: true, chat_template: this.template });
        const ids = this.tokenizer.encode(text, { add_special_tokens: false });
        const imgs = [...imageTokens], auds = [...audioTokenCounts];
        const out = [];
        for (const t of ids) {
            if (t === T.image) out.push(...Array(imgs.shift()).fill(T.image));
            else if (t === T.audio) out.push(...Array(auds.shift()).fill(T.audio));
            else out.push(t);
        }
        if (imgs.length || auds.length) throw new Error('Attachments and placeholders do not match');
        return { ids: [...out, ...prefill], text };
    }

    // ---- encoders

    async encodeImage(rgba, width, height) {
        const vision = await this.load('vision');
        const p = patchify(rgba, width, height);
        const r = await vision.run({ pixel_values: tensor('float32', p.data, p.dims) });
        return { features: r.image_features.data, tokens: p.tokens };
    }

    async encodeAudio(wave) {
        const enc = await this.load('audio');
        const mel = logMel(wave);
        const r = await enc.run({ input_features: tensor('float32', mel.data, [1, MELS, mel.frames]) });
        const tokens = r.audio_features.dims[0];
        if (tokens !== audioTokens(mel.frames)) throw new Error(`${mel.frames} mel frames gave ${tokens} audio features`);
        return { features: r.audio_features.data, tokens };
    }

    // ---- decoder

    newCache() {
        const cache = {};
        for (const m of this.sessions.decoder.inputMetadata) if (m.name.startsWith('past')) {
            const shape = m.shape.map(d => typeof d === 'number' ? d : (/sequence/.test(d) ? 0 : 1));
            const n = shape.reduce((a, b) => a * b, 1);
            cache[m.name] = tensor(m.type, m.type === 'float16' ? new Uint16Array(n) : new Float32Array(n), shape);
        }
        return { tensors: cache, past: 0 };
    }

    async step(cache, ids, side = {}) {
        const n = ids.length, past = cache.past;
        const feeds = {
            input_ids: tensor('int64', i64(ids), [1, n]),
            attention_mask: tensor('int64', new BigInt64Array(past + n).fill(1n), [1, past + n]),
            position_ids: tensor('int64', i64(Array.from({ length: n }, (_, i) => past + i)), [1, n]),
            logits_to_keep: tensor('int64', new BigInt64Array([1n]), [1]),
            image_features: side.image_features || noRows(HIDDEN),
            video_features: noRows(HIDDEN),
            audio_features: side.audio_features || noRows(HIDDEN),
            audio_out_codes: side.audio_out_codes || noCodes(),
            ...cache.tensors,
        };
        const r = await this.sessions.decoder.run(feeds);
        const logits = await r.logits.getData(true), hidden = await r.hidden_states.getData(true);
        for (const [name, value] of Object.entries(r)) {
            const p = name.startsWith('present_conv.') ? name.replace('present_conv.', 'past_conv.')
                : name.startsWith('present.') ? name.replace('present.', 'past_key_values.') : null;
            if (p && cache.tensors[p]) {
                if (cache.tensors[p].location === 'gpu-buffer') cache.tensors[p].dispose();
                cache.tensors[p] = value;
            }
        }
        cache.past += n;
        return { logits, hidden };
    }

    releaseCache(cache) {
        for (const t of Object.values(cache.tensors)) if (t.location === 'gpu-buffer') t.dispose();
    }

    // Prefill in chunks of at most 1024 tokens; each chunk takes the feature
    // rows of the placeholders it contains.
    async prefill(cache, ids, images, audios) {
        let iRow = 0, aRow = 0, out;
        for (let s = 0; s < ids.length; s += PREFILL_CHUNK) {
            const chunk = ids.slice(s, s + PREFILL_CHUNK);
            const ni = chunk.filter(t => t === T.image).length, na = chunk.filter(t => t === T.audio).length;
            const side = {};
            if (ni) side.image_features = tensor('float32', images.subarray(iRow * HIDDEN, (iRow + ni) * HIDDEN), [ni, HIDDEN]);
            if (na) side.audio_features = tensor('float32', audios.subarray(aRow * HIDDEN, (aRow + na) * HIDDEN), [na, HIDDEN]);
            iRow += ni; aRow += na;
            out = await this.step(cache, chunk, side);
        }
        return out;
    }

    async sampleFrame(hidden, history) {
        const depth = this.sessions.depth;
        const codes = new BigInt64Array(CODEBOOKS);
        const revealed = new Uint8Array(CODEBOOKS);
        const order = shuffled(CODEBOOKS);
        let at = 0;
        for (const n of MASKGIT) {
            const masked = Uint8Array.from(revealed, v => v ? 0 : 1);
            const r = await depth.run({
                hidden_states: tensor('float32', hidden, [1, HIDDEN]),
                codes: tensor('int64', codes, [1, CODEBOOKS]),
                masked: tensor('bool', masked, [1, CODEBOOKS]),
            });
            const logits = r.logits.data, V = r.logits.dims[2];
            for (const k of order.slice(at, at + n)) {
                const hist = history.length ? history.map(f => f[k]) : null;
                codes[k] = BigInt(sampleCode(logits.subarray(k * V, (k + 1) * V), hist));
                revealed[k] = 1;
            }
            at += n;
        }
        const frame = Array.from(codes, Number);
        return frame.includes(AUDIO_EOS) ? frame.fill(AUDIO_EOS) : frame;
    }

    async decodeSpeech(frames) {
        const codec = await this.load('codec');
        const F = frames.length, codes = new BigInt64Array(CODEBOOKS * F);
        for (let f = 0; f < F; f++) for (let k = 0; k < CODEBOOKS; k++) codes[k * F + f] = BigInt(frames[f][k]);
        const r = await codec.run({ audio_codes: tensor('int64', codes, [1, CODEBOOKS, F]) });
        return stftToWave(r.stft_features.data, r.stft_features.dims[1]);
    }

    forget(id) { this.features?.delete(id); }

    stop() { this.stopped = true; }

    // One assistant turn. mode: 'text' (text only), 'speech' (interleaved text
    // and speech), 'tts' (speech of the user's text), 'asr' (transcript).
    // callbacks: onText(piece), onFrame(count). Returns { text, wave, stats }.
    async generate({ messages, images = [], audios = [], mode = 'text', maxSlots = 768, onText, onFrame }) {
        await this.loadTokenizer();
        await this.load('decoder');
        const speech = mode === 'speech' || mode === 'tts';
        if (speech) await Promise.all([this.load('depth'), this.load('codec')]);
        this.stopped = false;
        const t0 = performance.now();

        // Attachments carry an id; their features are kept, so a conversation
        // does not re-encode the same picture or recording every turn.
        this.features ??= new Map();
        const encoded = async (item, encode) => {
            if (item.id != null && this.features.has(item.id)) return this.features.get(item.id);
            const rows = await encode();
            if (item.id != null) this.features.set(item.id, rows);
            return rows;
        };
        const imageRows = [], audioRows = [];
        for (const im of images) imageRows.push(await encoded(im, () => this.encodeImage(im.rgba, im.width, im.height)));
        for (const a of audios) {
            const wave = a instanceof Float32Array ? a : a.wave;
            audioRows.push(await encoded(a instanceof Float32Array ? {} : a, () => this.encodeAudio(wave)));
        }
        const concat = rows => {
            const out = new Float32Array(rows.reduce((a, r) => a + r.features.length, 0));
            let o = 0;
            for (const r of rows) { out.set(r.features, o); o += r.features.length; }
            return out;
        };
        const prefillTokens = mode === 'speech' ? [T.mixedStart] : mode === 'tts' ? [T.audioStart] : [];
        const { ids, text: promptText } = this.promptIds(messages, imageRows.map(r => r.tokens), audioRows.map(r => r.tokens), prefillTokens);
        const tEncoded = performance.now();

        const cache = this.newCache();
        let { logits, hidden } = await this.prefill(cache, ids, concat(imageRows), concat(audioRows));
        const tPrefill = performance.now();

        const suppress = new Set([T.image, T.video, T.audio, T.audioOut]);
        if (mode === 'text' || mode === 'asr') { suppress.add(T.mixedStart); suppress.add(T.audioStart); }
        let state = mode === 'speech' ? 'interleaved' : mode === 'tts' ? 'audio' : 'text';
        let slotsLeft = INTERLEAVED_TEXT, speaking = false, textDone = false;
        const textIds = [], frames = [], history = [];
        let emitted = '';
        try {
            for (let step = 0; step < maxSlots && !this.stopped; step++) {
                const interleaving = state === 'interleaved';
                let next, codes = null, finished = false;
                if (state === 'audio' || (interleaving && speaking)) {
                    const frame = await this.sampleFrame(hidden, history);
                    if (frame[0] === AUDIO_EOS) state = 'text';
                    else {
                        frames.push(frame); history.push(frame);
                        if (history.length > AUDIO_SAMPLING.window) history.shift();
                        onFrame?.(frames.length);
                    }
                    next = T.audioOut;
                    codes = tensor('int64', i64(frame), [1, CODEBOOKS]);
                } else {
                    let best = -1, bestV = -Infinity;
                    for (let i = 0; i < logits.length; i++) if (!suppress.has(i) && logits[i] > bestV) { bestV = logits[i]; best = i; }
                    next = best;
                    if (best === T.textEnd) { if (interleaving) textDone = speaking = true; else finished = true; }
                    else if (best === T.eos) finished = true;
                    else if (!interleaving && best === T.audioStart) state = 'audio';
                    else if (!interleaving && best === T.mixedStart) { state = 'interleaved'; slotsLeft = INTERLEAVED_TEXT; speaking = textDone = false; }
                    else {
                        textIds.push(best);
                        const all = this.tokenizer.decode(textIds, { skip_special_tokens: true });
                        if (all.length > emitted.length) { onText?.(all.slice(emitted.length)); emitted = all; }
                    }
                }
                if (interleaving && !textDone && --slotsLeft === 0) {
                    speaking = !speaking;
                    slotsLeft = speaking ? INTERLEAVED_AUDIO : INTERLEAVED_TEXT;
                }
                if (finished) break;
                ({ logits, hidden } = await this.step(cache, [next], codes ? { audio_out_codes: codes } : {}));
            }
        } finally {
            this.releaseCache(cache);
        }
        const tGen = performance.now();
        const wave = frames.length ? await this.decodeSpeech(frames) : null;
        return {
            text: emitted,
            wave,
            promptText,
            stats: {
                promptTokens: ids.length, textTokens: textIds.length, frames: frames.length,
                imageTokens: imageRows.reduce((a, r) => a + r.tokens, 0),
                audioTokens: audioRows.reduce((a, r) => a + r.tokens, 0),
                encodeMs: tEncoded - t0, prefillMs: tPrefill - tEncoded, generateMs: tGen - tPrefill,
                speechSeconds: wave ? wave.length / 24000 : 0,
            },
        };
    }
}
