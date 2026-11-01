// Worker for the Multimodal Sandbox: runs shared/omni-model.js off the page's
// thread so recording, playback and scrolling stay smooth while the model works.
//
// Messages in:  check · load {part} · generate {request} · forget {id} · stop · clear
// Messages out: device {error} · cached {parts} · progress {...} · text {piece}
//               · frame {count} · done {result} · error {message}
import { OmniModel, cachedParts, clearDownloads } from '../shared/omni-model.js?v=3.5.0';

const model = new OmniModel({ onProgress: p => self.postMessage({ type: 'progress', ...p }) });
let busy = false;

self.addEventListener('message', async ({ data }) => {
    const { type } = data;
    try {
        if (type === 'check') {
            self.postMessage({ type: 'device', error: await OmniModel.checkDevice() });
            self.postMessage({ type: 'cached', parts: await cachedParts() });
        } else if (type === 'load') {
            await model.loadTokenizer();
            await model.load(data.part);
            self.postMessage({ type: 'cached', parts: await cachedParts() });
        } else if (type === 'clear') {
            await clearDownloads();
            self.postMessage({ type: 'cleared' });
        } else if (type === 'forget') {
            model.forget(data.id);
        } else if (type === 'stop') {
            model.stop();
        } else if (type === 'generate') {
            if (busy) return;
            busy = true;
            const result = await model.generate({
                ...data.request,
                onText: piece => self.postMessage({ type: 'text', piece }),
                onFrame: count => self.postMessage({ type: 'frame', count }),
            });
            const transfer = result.wave ? [result.wave.buffer] : [];
            self.postMessage({ type: 'done', result }, transfer);
            self.postMessage({ type: 'cached', parts: await cachedParts() });
        }
    } catch (e) {
        console.error(e);
        self.postMessage({ type: 'error', message: e.message || String(e) });
    } finally {
        if (type === 'generate') busy = false;
    }
});
