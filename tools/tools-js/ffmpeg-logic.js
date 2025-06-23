const { createFFmpeg, fetchFile } = FFmpeg;

let ffmpeg = createFFmpeg({
  log: true,
  corePath: '../../libs/ffmpeg-core.js',
  wasmPath: '../../libs/ffmpeg-core.wasm',
  memorySize: 2 * 1024 * 1024 * 1024,
  logger: ({ type, message }) => console.log(`[${type}] ${message}`),
});

function recreateFFmpeg() {
  ffmpeg = createFFmpeg({
    log: true,
    corePath: '../../libs/ffmpeg-core.js',
    wasmPath: '../../libs/ffmpeg-core.wasm',
    memorySize: 2 * 1024 * 1024 * 1024,
    logger: ({ type, message }) => console.log(`[${type}] ${message}`),
  });
}

export async function processExport({
  file,
  start,
  end,
  resolution,
  quality,
  mute,
  audioBitrate,
  onProgress,
  onComplete,
  onError,
}) {
  try {
    if (!ffmpeg.isLoaded()) {
      await ffmpeg.load();
    }

    ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(file));

    const clipDuration = end - start;
    const [preset, crf] = quality.split('-');

    const args = [
      '-ss', `${start}`,
      '-t', `${clipDuration}`,
      '-i', 'input.mp4',
      '-c:v', 'libx264',
      '-preset', preset,
      '-crf', crf,
    ];

    if (resolution !== 'original' && /^\d+:\d+$/.test(resolution)) {
      args.push('-vf', `scale=${resolution}`);
    }

    if (mute) {
      args.push('-an');
    } else {
      args.push('-c:a', 'aac', '-b:a', audioBitrate);
    }

    args.push('output.mp4');

    ffmpeg.setProgress(({ ratio }) => {
      if (onProgress) onProgress(Math.round(ratio * 100));
    });

    await ffmpeg.run(...args);

    const data = ffmpeg.FS('readFile', 'output.mp4');
    const blobUrl = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));

    if (onComplete) onComplete(blobUrl);
  } catch (e) {
    if (onError) onError(e);
  }
}

export async function cancelProcessing() {
  try {
    await ffmpeg.exit();
  } catch (e) {
    console.error('FFmpeg cancel error:', e);
  }
  recreateFFmpeg();
}