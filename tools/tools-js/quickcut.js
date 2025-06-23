const { createFFmpeg, fetchFile } = FFmpeg;

const ffmpeg = createFFmpeg({
  log: true,
  corePath: '../../libs/ffmpeg-core.js',
  wasmPath: '../../libs/ffmpeg-core.wasm',
  memorySize: 2 * 1024 * 1024 * 1024,
  logger: ({ type, message }) => {
    // Optional: Keep console log for debugging
    console.log(`[${type}] ${message}`);
  },
});

const videoInput = document.getElementById('videoInput');
const videoPreview = document.getElementById('videoPreview');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const muteAudioCheckbox = document.getElementById('muteAudio');
const exportBtn = document.getElementById('exportBtn');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

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

  // Show and reset progress UI
  progressBar.style.display = 'block';
  progressBar.value = 0;
  progressText.style.display = 'block';
  progressText.textContent = 'Starting...';

  try {
    if (!ffmpeg.isLoaded()) {
      await ffmpeg.load();
    }

    ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoFile));

    const duration = end - start;
    const args = [
      '-ss', `${start}`,
      '-t', `${duration}`,
      '-i', 'input.mp4',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      ...(mute ? ['-an'] : ['-c:a', 'aac']),
      'output.mp4',
    ];

    // Track progress with ffmpeg.setProgress
    ffmpeg.setProgress(({ ratio }) => {
      const percent = Math.round(ratio * 100);
      progressBar.value = percent;
      progressText.textContent = `Processing: ${percent}%`;
    });

    await ffmpeg.run(...args);

    const data = ffmpeg.FS('readFile', 'output.mp4');
    const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));

    const a = document.createElement('a');
    a.href = url;
    a.download = 'quickcut_output.mp4';
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);

  } catch (e) {
    console.error('Error during video processing:', e);
    alert('Error during video processing: ' + e.message);
  }

  // Hide progress bar/text and re-enable button
  progressBar.style.display = 'none';
  progressText.style.display = 'none';

  exportBtn.disabled = false;
  exportBtn.textContent = '📤 Export to MP4';
});