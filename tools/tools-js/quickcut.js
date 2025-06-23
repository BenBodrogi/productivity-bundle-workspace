const { createFFmpeg, fetchFile } = FFmpeg;

const ffmpeg = createFFmpeg({
  log: true,
  corePath: '../../libs/ffmpeg-core.js',
  wasmPath: '../../libs/ffmpeg-core.wasm',
  memorySize: 2 * 1024 * 1024 * 1024, // 2GB memory
});

const videoInput = document.getElementById('videoInput');
const videoPreview = document.getElementById('videoPreview');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const muteAudioCheckbox = document.getElementById('muteAudio');
const exportBtn = document.getElementById('exportBtn');

let videoFile;

videoInput.addEventListener('change', () => {
  const file = videoInput.files[0];
  if (!file) return;

  videoFile = file;
  videoPreview.src = URL.createObjectURL(file);
  videoPreview.load();

  videoPreview.onloadedmetadata = () => {
    endTimeInput.value = Math.floor(videoPreview.duration);
    startTimeInput.value = 0;
  };
});

exportBtn.addEventListener('click', async () => {
  if (!videoFile) {
    alert('Please upload a video first!');
    return;
  }

  const start = parseFloat(startTimeInput.value);
  const end = parseFloat(endTimeInput.value);
  const mute = muteAudioCheckbox.checked;

  if (isNaN(start) || isNaN(end) || start >= end) {
    alert('Please enter valid start and end times, where start < end.');
    return;
  }

  exportBtn.disabled = true;
  exportBtn.textContent = 'Processing...';

  try {
    if (!ffmpeg.isLoaded()) {
      console.log('Loading ffmpeg core...');
      await ffmpeg.load();
      console.log('ffmpeg core loaded.');
    }

    ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoFile));

    const duration = end - start;
    const args = [
      '-ss', `${start}`,
      '-t', `${duration}`,
      '-i', 'input.mp4',
      '-c', 'copy',
      ...(mute ? ['-an'] : []),
      'output.webm',
    ];

    console.log('Running ffmpeg with args:', args.join(' '));
    await ffmpeg.run(...args);
    console.log('ffmpeg processing finished.');

    const data = ffmpeg.FS('readFile', 'output.webm');
    const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/webm' }));

    const a = document.createElement('a');
    a.href = url;
    a.download = 'quickcut_output.webm';
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);

  } catch (e) {
    console.error('Error during video processing:', e);
    alert('Error during video processing: ' + e.message);
  }

  exportBtn.disabled = false;
  exportBtn.textContent = '📤 Export to WebM';
});