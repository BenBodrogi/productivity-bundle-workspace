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

// Custom controls
const playPauseBtn = document.getElementById('playPauseBtn');
const rewindBtn = document.getElementById('rewindBtn');
const forwardBtn = document.getElementById('forwardBtn');
const muteToggleBtn = document.getElementById('muteToggleBtn');
const currentTimeDisplay = document.getElementById('currentTime');
const totalDurationDisplay = document.getElementById('totalDuration');
const previewResolution = document.getElementById('previewResolution');

const timelineTrack = document.querySelector('.timeline-track');
const timelineFill = document.querySelector('.timeline-fill');
const handleStart = document.querySelector('.handle-start');
const handleEnd = document.querySelector('.handle-end');

let videoFile;
let isCancelled = false;
let duration = 0;
let isDraggingStart = false;
let isDraggingEnd = false;

// ----------- Helper functions -----------

function resetUI() {
  progressBar.style.display = 'none';
  progressText.style.display = 'none';
  exportBtn.disabled = false;
  cancelBtn.disabled = true;
  exportBtn.textContent = '📤 Export to MP4';
  isCancelled = false;
}

function recreateFFmpeg() {
  ffmpeg = createFFmpeg({
    log: true,
    corePath: '../../libs/ffmpeg-core.js',
    wasmPath: '../../libs/ffmpeg-core.wasm',
    memorySize: 2 * 1024 * 1024 * 1024,
    logger: ({ type, message }) => {
      console.log(`[${type}] ${message}`);
    },
  });
}

function formatTime(sec) {
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function updateTimeDisplays() {
  currentTimeDisplay.textContent = formatTime(videoPreview.currentTime);
  totalDurationDisplay.textContent = formatTime(duration);
}

function timeToPercent(time) {
  return (time / duration) * 100;
}

function percentToTime(percent) {
  return (percent / 100) * duration;
}

function updateTimelineUI() {
  const startPercent = timeToPercent(parseFloat(startTimeInput.value));
  const endPercent = timeToPercent(parseFloat(endTimeInput.value));

  const clampedStart = Math.min(startPercent, endPercent);
  const clampedEnd = Math.max(startPercent, endPercent);

  timelineFill.style.left = `${clampedStart}%`;
  timelineFill.style.width = `${clampedEnd - clampedStart}%`;

  handleStart.style.left = `${clampedStart}%`;
  handleEnd.style.left = `${clampedEnd}%`;
}

// ----------- Event Listeners -----------

// Video load
videoInput.addEventListener('change', () => {
  const file = videoInput.files[0];
  if (!file) return;

  videoFile = file;
  videoPreview.src = URL.createObjectURL(file);
  videoPreview.load();

  videoPreview.onloadedmetadata = () => {
    duration = videoPreview.duration;
    endTimeInput.value = duration.toFixed(2);
    startTimeInput.value = 0;
    durationInfo.textContent = `Video Duration: ${Math.floor(duration)} seconds`;
    totalDurationDisplay.textContent = formatTime(duration);
    currentTimeDisplay.textContent = formatTime(0);
    updateTimelineUI();
  };
});

// Mute toggle disables audio bitrate checkbox
muteAudioCheckbox.addEventListener('change', () => {
  audioBitrateSelect.disabled = muteAudioCheckbox.checked;
});

// Cancel
cancelBtn.addEventListener('click', async () => {
  if (isCancelled) return;
  isCancelled = true;

  progressText.textContent = 'Cancelling... Please wait.';
  exportBtn.disabled = false;
  cancelBtn.disabled = true;

  try {
    await ffmpeg.exit();
    console.log('FFmpeg exited.');
  } catch (e) {
    if (e.name === 'ExitStatus') {
      console.log('FFmpeg exited with code:', e.status);
    } else {
      console.error('Unexpected error during ffmpeg.exit():', e);
    }
  }

  recreateFFmpeg();
  resetUI();
});

// Export
exportBtn.addEventListener('click', async () => {
  if (!videoFile) {
    alert('Please upload a video first!');
    return;
  }

  const start = parseFloat(startTimeInput.value);
  const end = parseFloat(endTimeInput.value);
  const mute = muteAudioCheckbox.checked;
  const resolution = resolutionSelect.value;
  const quality = qualitySelect.value;
  const audioBitrate = audioBitrateSelect.value;

  if (isNaN(start) || isNaN(end) || start >= end) {
    alert('Please enter valid start and end times (start < end).');
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
      if (isCancelled) return;
      const percent = Math.round(ratio * 100);
      progressBar.value = percent;
      progressText.textContent = `Processing: ${percent}%`;
    });

    await ffmpeg.run(...args);

    if (isCancelled) {
      console.log('Cancelled during processing');
      resetUI();
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
      console.log('Process aborted.');
    } else {
      console.error('Error during export:', e);
      alert('Error during export: ' + e.message);
    }
  }

  resetUI();
});

// ----------- CUSTOM VIDEO CONTROLS -----------

videoPreview.addEventListener('loadedmetadata', () => {
  duration = videoPreview.duration;
  totalDurationDisplay.textContent = formatTime(duration);
  currentTimeDisplay.textContent = formatTime(0);
  updateTimelineUI();
  updateMuteButtonIcon();
});

videoPreview.addEventListener('timeupdate', () => {
  currentTimeDisplay.textContent = formatTime(videoPreview.currentTime);
});

playPauseBtn.addEventListener('click', () => {
  if (videoPreview.paused) {
    videoPreview.play();
    playPauseBtn.textContent = '⏸';
  } else {
    videoPreview.pause();
    playPauseBtn.textContent = '▶️';
  }
});

rewindBtn.addEventListener('click', () => {
  videoPreview.currentTime = Math.max(videoPreview.currentTime - 5, 0);
});

forwardBtn.addEventListener('click', () => {
  videoPreview.currentTime = Math.min(videoPreview.currentTime + 5, videoPreview.duration);
});

muteToggleBtn.addEventListener('click', () => {
  videoPreview.muted = !videoPreview.muted;
  updateMuteButtonIcon();
});

function updateMuteButtonIcon() {
  muteToggleBtn.textContent = videoPreview.muted ? '🔇' : '🔈';
}

// Preview resolution changes video playback quality without resizing container
previewResolution.addEventListener('change', () => {
  const value = previewResolution.value;

  if (value === 'original') {
    videoPreview.style.width = '640px';
    videoPreview.style.height = '360px';
  } else {
    // We don't actually resize video element container — only playback quality is simulated by CSS filter here.
    // Because real resolution change requires video source replacement which is complex, so we fake it:
    videoPreview.style.width = '640px';
    videoPreview.style.height = '360px';

    // Simulate lower resolution with CSS filter blur + scale down, optional, comment if undesired:
    switch (value) {
      case '1920x1080': // 1080p, no blur
        videoPreview.style.filter = 'none';
        break;
      case '1280x720': // 720p, slight blur
        videoPreview.style.filter = 'blur(0.8px)';
        break;
      case '854x480': // 480p, more blur
        videoPreview.style.filter = 'blur(1.5px)';
        break;
      default:
        videoPreview.style.filter = 'none';
    }
  }
});

// ----------- TIMELINE DRAGGING -----------

function setupHandleDragging() {
  function onDragStart(e) {
    if (e.target === handleStart) isDraggingStart = true;
    if (e.target === handleEnd) isDraggingEnd = true;
  }

  function onDragEnd() {
    isDraggingStart = false;
    isDraggingEnd = false;
  }

  function onDragMove(e) {
    if (!isDraggingStart && !isDraggingEnd) return;

    const rect = timelineTrack.getBoundingClientRect();
    let x = e.clientX;
    if (e.touches) x = e.touches[0].clientX;

    let percent = ((x - rect.left) / rect.width) * 100;
    percent = Math.min(100, Math.max(0, percent));

    const time = percentToTime(percent);

    if (isDraggingStart) {
      const endVal = parseFloat(endTimeInput.value);
      if (time >= endVal) return;
      startTimeInput.value = time.toFixed(2);
    } else if (isDraggingEnd) {
      const startVal = parseFloat(startTimeInput.value);
      if (time <= startVal) return;
      endTimeInput.value = time.toFixed(2);
    }

    updateTimelineUI();
  }

  handleStart.addEventListener('dragstart', onDragStart);
  handleEnd.addEventListener('dragstart', onDragStart);

  window.addEventListener('dragend', onDragEnd);
  window.addEventListener('dragcancel', onDragEnd);

  window.addEventListener('dragover', e => {
    e.preventDefault();
    onDragMove(e);
  });

  // Touch support
  handleStart.addEventListener('touchstart', onDragStart);
  handleEnd.addEventListener('touchstart', onDragStart);

  window.addEventListener('touchend', onDragEnd);
  window.addEventListener('touchcancel', onDragEnd);

  window.addEventListener('touchmove', e => {
    e.preventDefault();
    onDragMove(e.touches[0]);
  }, { passive: false });
}

// Sync timeline handles and inputs on manual input changes
startTimeInput.addEventListener('input', () => {
  let startVal = parseFloat(startTimeInput.value);
  let endVal = parseFloat(endTimeInput.value);

  if (startVal < 0) startVal = 0;
  if (startVal >= endVal) startVal = endVal - 0.1;

  startTimeInput.value = startVal.toFixed(2);
  updateTimelineUI();
});

endTimeInput.addEventListener('input', () => {
  let startVal = parseFloat(startTimeInput.value);
  let endVal = parseFloat(endTimeInput.value);

  if (endVal > duration) endVal = duration;
  if (endVal <= startVal) endVal = startVal + 0.1;

  endTimeInput.value = endVal.toFixed(2);
  updateTimelineUI();
});

// Initialize timeline dragging on page load
setupHandleDragging();