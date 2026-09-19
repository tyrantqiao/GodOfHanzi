import { parentPort, workerData } from 'node:worker_threads';
import path from 'node:path';
import { createRequire } from 'node:module';

try {
  const require = createRequire(import.meta.url);
  const sherpa = require('sherpa-onnx-node');
  const file = name => path.join(workerData.modelDir, name);
  const tts = new sherpa.OfflineTts({
    model: {
      kokoro: {
        model: file('model.onnx'), voices: file('voices.bin'),
        tokens: file('tokens.txt'), dataDir: file('espeak-ng-data'),
        lexicon: `${file('lexicon-us-en.txt')},${file('lexicon-zh.txt')}`,
      },
      numThreads: 2, provider: 'cpu', debug: false,
    },
    maxNumSentences: 1,
  });
  parentPort.postMessage({ ready: true });
  parentPort.on('message', ({ id, text, sid, speed, output }) => {
    try {
      const audio = tts.generate({ text, generationConfig: new sherpa.GenerationConfig({ sid, speed }) });
      if (!audio.samples.length) throw new Error('Speech model generated empty audio');
      if (!sherpa.writeWave(output, { samples: audio.samples, sampleRate: audio.sampleRate })) {
        throw new Error('Unable to write speech audio');
      }
      parentPort.postMessage({ id });
    } catch (error) {
      parentPort.postMessage({ id, error: error.message });
    }
  });
} catch (error) {
  parentPort.postMessage({ error: error.message });
}
