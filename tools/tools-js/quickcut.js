const { createFFmpeg, fetchFile } = FFmpeg;

let ffmpeg = createFFmpeg({
  log: true,
  corePath: '../../libs/ffmpeg-core.js',
  wasmPath: '../../libs/ffmpeg-core.wasm',
  memorySize: 2 * 1024 * 1024 * 1024,
  logger: ({ type, message }) => {
    console.log(`[${type}] ${message}`);
  },
});

const videoInput = document.getElementById('videoInput');
const videoPreview = document.getElementById('videoPreview');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const muteAudioCheckbox = document.getElementById('muteAudio');
const exportBtn = document.getElementById('exportBtn');
const cancelBtn = document.getElementById('cancelBtn');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const durationInfo = document.getElementById('durationInfo');

const resolutionSelect = document.getElementById('resolutionSelect');
const qualitySelect = document.getElementById('qualitySelect');
const audioBitrateSelect = document.getElementById('audioBitrateSelect');

let videoFile;
let isCancelled = false;

videoInput.addEventListener('change', () => {
  const file = videoInput.files[0];
  if (!file) return;

  videoFile = file;
  videoPreview.src = URL.createObjectURL(file);
  videoPreview.load();

  videoPreview.onloadedmetadata = () => {
    const duration = Math.floor(videoPreview.duration);
    endTimeInput.value = duration;
    startTimeInput.value = 0;
    durationInfo.textContent = `Video Duration: ${duration} seconds`;
  };
});

muteAudioCheckbox.addEventListener('change', () => {
  audioBitrateSelect.disabled = muteAudioCheckbox.checked;
});

cancelBtn.addEventListener('click', () => {
  if (!isCancelled) {
    isCancelled = true;
    progressText.textContent = 'Cancelling... Please wait.';
    exportBtn.disabled = false;
    cancelBtn.disabled = true;

    // Recreate ffmpeg to abort running process safely
    ffmpeg.exit().then(() => {
      ffmpeg = createFFmpeg({
        log: true,
        corePath: '../../libs/ffmpeg-core.js',
        wasmPath: '../../libs/ffmpeg-core.wasm',
        memorySize: 2 * 1024 * 1024 * 1024,
        logger: ({ type, message }) => {
          console.log(`[${type}] ${message}`);
        },
      });
    });
  }
});

exportBtn.addEventListener('click', async () => {
  if (!videoFile) {
    alert('Please upload a video first!');
    return;
  }

  const start = parseFloat(startTimeInput.value);
  const end = parseFloat(endTimeInput.value);
  const mute = muteAudioCheckbox.checked;
  const resolution = resolutionSelect.value;
  const quality = qualitySelect.value; // format: "preset-crf"
  const audioBitrate = audioBitrateSelect.value;

  if (isNaN(start) || isNaN(end) || start >= end) {
    alert('Please enter valid start and end times, where start < end.');
    return;
  }

  isCancelled = false;
  exportBtn.disabled = true;
  cancelBtn.disabled = false;
  exportBtn.textContent = 'Processing...';

  progressBar.style.display = 'block';
  progressBar.value = 0;
  progressText.style.display = 'block';
  progressText.textContent = 'Loading FFmpeg...';

  try {
    if (!ffmpeg.isLoaded()) {
      await ffmpeg.load();
    }

    ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoFile));

    const duration = end - start;
    const [preset, crf] = quality.split('-');

    const args = [
      '-ss', `${start}`,
      '-t', `${duration}`,
      '-i', 'input.mp4',
      '-c:v', 'libx264',
      '-preset', preset,
      '-crf', crf,
    ];

    if (resolution !== 'original') {
      if (/^\d+:\d+$/.test(resolution)) {
        args.push('-vf', `scale=${resolution}`);
      } else {
        console.warn('Invalid resolution format, skipping scale filter.');
      }
    }

    if (mute) {
      args.push('-an');
    } else {
      args.push('-c:a', 'aac');
      args.push('-b:a', audioBitrate);
    }

    args.push('output.mp4');

    ffmpeg.setProgress(({ ratio }) => {
      if (isCancelled) {
        // Ideally the process should be stopped by ffmpeg.exit() on cancel click,
        // but if it runs, we prevent UI updates:
        return;
      }
      const percent = Math.round(ratio * 100);
      progressBar.value = percent;
      progressText.textContent = `Processing: ${percent}%`;
    });

    await ffmpeg.run(...args);

    if (isCancelled) {
      progressText.textContent = 'Cancelled.';
      progressBar.style.display = 'none';
      progressText.style.display = 'none';
      cancelBtn.disabled = true;
      exportBtn.disabled = false;
      exportBtn.textContent = '📤 Export to MP4';
      return;
    }

    progressText.textContent = 'Export complete! Preparing download...';
    progressBar.value = 100;

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
    if (isCancelled) {
      console.log('Export cancelled by user.');
    } else {
      console.error('Error during video processing:', e);
      alert('Error during video processing: ' + e.message);
    }
  }

  // Reset UI states
  progressBar.style.display = 'none';
  progressText.style.display = 'none';
  exportBtn.disabled = false;
  exportBtn.textContent = '📤 Export to MP4';
  cancelBtn.disabled = true;
});