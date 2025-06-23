// quickcut.js
import { processExport, cancelProcessing } from 'ffmpeg-logic.js';

const videoInput = document.getElementById('videoInput');
const videoPreview = document.getElementById('videoPreview');

const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');

const muteAudioCheckbox = document.getElementById('muteAudio');
const audioBitrateSelect = document.getElementById('audioBitrateSelect');
const exportBtn = document.getElementById('exportBtn');
const cancelBtn = document.getElementById('cancelBtn');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const durationInfo = document.getElementById('durationInfo');

const resolutionSelect = document.getElementById('resolutionSelect');
const qualitySelect = document.getElementById('qualitySelect');

const playPauseBtn = document.getElementById('playPauseBtn');
const rewindBtn = document.getElementById('rewindBtn');
const forwardBtn = document.getElementById('forwardBtn');
const muteToggleBtn = document.getElementById('muteToggleBtn');
const volumeSlider = document.getElementById('volumeSlider');

const currentTimeDisplay = document.getElementById('currentTime');
const totalDurationDisplay = document.getElementById('totalDuration');

const previewResolution = document.getElementById('previewResolution');
const videoProgress = document.getElementById('videoProgress');

const timelineTrack = document.querySelector('.timeline-track');
const timelineFill = document.querySelector('.timeline-fill');
const handleStart = document.querySelector('.handle-start');
const handleEnd = document.querySelector('.handle-end');

let videoFile;
let isDraggingStart = false;
let isDraggingEnd = false;
let isDraggingVideoProgress = false;

// ---------------------------------
// Time helpers mm:ss <-> seconds
function formatTime(sec) {
  if (isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function parseTime(str) {
  // expects "mm:ss"
  const parts = str.split(':');
  if (parts.length !== 2) return NaN;
  const m = parseInt(parts[0], 10);
  const s = parseInt(parts[1], 10);
  if (isNaN(m) || isNaN(s) || s >= 60 || m < 0 || s < 0) return NaN;
  return m * 60 + s;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function timeToPercent(time) {
  return (time / videoPreview.duration) * 100;
}

function percentToTime(percent) {
  return (percent / 100) * videoPreview.duration;
}

function resetUI() {
  progressBar.style.display = 'none';
  progressText.style.display = 'none';
  exportBtn.disabled = false;
  cancelBtn.disabled = true;
  exportBtn.textContent = '📤 Export';
}

// ---------------------------------
// Video loading

videoInput.addEventListener('change', () => {
  const file = videoInput.files[0];
  if (!file) return;

  videoFile = file;
  videoPreview.src = URL.createObjectURL(file);
  videoPreview.load();

  videoPreview.onloadedmetadata = () => {
    const duration = videoPreview.duration;
    startTimeInput.value = '0:00';
    endTimeInput.value = formatTime(duration);
    videoProgress.max = duration;
    videoProgress.value = 0;

    durationInfo.textContent = `Video Duration: ${formatTime(duration)}`;
    totalDurationDisplay.textContent = formatTime(duration);
    currentTimeDisplay.textContent = formatTime(0);
    updateTimelineUI();
  };
});

// ---------------------------------
// Export button and cancel logic

exportBtn.addEventListener('click', async () => {
  if (!videoFile) {
    alert('Please upload a video first!');
    return;
  }

  const start = parseTime(startTimeInput.value);
  const end = parseTime(endTimeInput.value);
  const videoDuration = videoPreview.duration;

  if (isNaN(start) || isNaN(end) || start >= end || end > videoDuration) {
    alert('Please enter valid start and end times (start < end and within video length).');
    return;
  }

  const mute = muteAudioCheckbox.checked || volumeSlider.value == 0;
  const resolution = resolutionSelect.value;
  const quality = qualitySelect.value;
  const audioBitrate = audioBitrateSelect.value;

  exportBtn.disabled = true;
  cancelBtn.disabled = false;
  exportBtn.textContent = 'Processing...';
  progressBar.style.display = 'block';
  progressBar.value = 0;
  progressText.style.display = 'block';
  progressText.textContent = 'Loading FFmpeg...';

  try {
    await processExport({
      file: videoFile,
      start,
      end,
      resolution,
      quality,
      mute,
      audioBitrate,
      onProgress: (percent) => {
        progressBar.value = percent;
        progressText.textContent = `Processing: ${percent}%`;
      },
      onComplete: (blobUrl) => {
        progressText.textContent = 'Export complete! Preparing download...';
        progressBar.value = 100;

        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = 'quickcut_output.mp4';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);

        resetUI();
      },
      onError: (error) => {
        alert('Error during export: ' + error.message);
        resetUI();
      }
    });
  } catch (e) {
    alert('Unexpected error: ' + e.message);
    resetUI();
  }
});

cancelBtn.addEventListener('click', async () => {
  exportBtn.disabled = false;
  cancelBtn.disabled = true;
  progressText.textContent = 'Cancelling... Please wait.';

  try {
    await cancelProcessing();
  } catch (e) {
    console.error('Cancel error:', e);
  }

  resetUI();
});

// ---------------------------------
// PLAY/PAUSE button

playPauseBtn.addEventListener('click', () => {
  if (videoPreview.paused) {
    videoPreview.play();
  } else {
    videoPreview.pause();
  }
});
videoPreview.addEventListener('play', () => {
  playPauseBtn.textContent = '⏸️';
});
videoPreview.addEventListener('pause', () => {
  playPauseBtn.textContent = '▶️';
});

// ---------------------------------
// Mute checkbox & volume slider sync

function updateAudioState() {
  if (muteAudioCheckbox.checked || volumeSlider.value == 0) {
    videoPreview.muted = true;
    audioBitrateSelect.disabled = true;
    muteToggleBtn.textContent = '🔇';
  } else {
    videoPreview.muted = false;
    audioBitrateSelect.disabled = false;
    muteToggleBtn.textContent = '🔈';
  }
}

muteAudioCheckbox.addEventListener('change', () => {
  if (muteAudioCheckbox.checked) {
    volumeSlider.value = 0;
  } else if (volumeSlider.value == 0) {
    volumeSlider.value = 1;
  }
  updateAudioState();
  videoPreview.volume = volumeSlider.value;
});

volumeSlider.addEventListener('input', () => {
  if (volumeSlider.value == 0) {
    muteAudioCheckbox.checked = true;
  } else {
    muteAudioCheckbox.checked = false;
  }
  updateAudioState();
  videoPreview.volume = volumeSlider.value;
});

// MUTE toggle button

muteToggleBtn.addEventListener('click', () => {
  const wasMuted = videoPreview.muted;
  videoPreview.muted = !wasMuted;
  muteAudioCheckbox.checked = videoPreview.muted;
  volumeSlider.value = videoPreview.muted ? 0 : videoPreview.volume;
  muteToggleBtn.textContent = wasMuted ? '🔈' : '🔇';
  audioBitrateSelect.disabled = videoPreview.muted;
});

// ---------------------------------
// Video time update and progress slider sync

videoPreview.addEventListener('timeupdate', () => {
  if (!isDraggingVideoProgress) {
    currentTimeDisplay.textContent = formatTime(videoPreview.currentTime);
    videoProgress.value = videoPreview.currentTime;
  }
});

videoProgress.addEventListener('pointerdown', () => {
  isDraggingVideoProgress = true;
});
videoProgress.addEventListener('input', () => {
  currentTimeDisplay.textContent = formatTime(videoProgress.value);
});
videoProgress.addEventListener('pointerup', () => {
  videoPreview.currentTime = videoProgress.value;
  isDraggingVideoProgress = false;
});
videoProgress.addEventListener('pointercancel', () => {
  isDraggingVideoProgress = false;
});
videoProgress.addEventListener('pointerleave', () => {
  isDraggingVideoProgress = false;
});

// ---------------------------------
// Preview resolution selector

previewResolution.addEventListener('change', () => {
  const val = previewResolution.value;
  switch (val) {
    case 'original':
      videoPreview.removeAttribute('width');
      videoPreview.removeAttribute('height');
      break;
    case '1920x1080':
      videoPreview.width = 1920;
      videoPreview.height = 1080;
      break;
    case '1280x720':
      videoPreview.width = 1280;
      videoPreview.height = 720;
      break;
    case '854x480':
      videoPreview.width = 854;
      videoPreview.height = 480;
      break;
    default:
      videoPreview.removeAttribute('width');
      videoPreview.removeAttribute('height');
  }
  videoPreview.style.filter = 'none';
});

// ---------------------------------
// Timeline slider drag and input sync

function updateTimelineUI() {
  const startSec = clamp(parseTime(startTimeInput.value), 0, videoPreview.duration);
  const endSec = clamp(parseTime(endTimeInput.value), 0, videoPreview.duration);

  const startPercent = timeToPercent(startSec);
  const endPercent = timeToPercent(endSec);

  timelineFill.style.left = `${startPercent}%`;
  timelineFill.style.width = `${endPercent - startPercent}%`;

  handleStart.style.left = `${startPercent}%`;
  handleEnd.style.left = `${endPercent}%`;

  // Clamp inputs
  if (startSec >= endSec) {
    startTimeInput.style.borderColor = 'red';
    endTimeInput.style.borderColor = 'red';
  } else {
    startTimeInput.style.borderColor = '';
    endTimeInput.style.borderColor = '';
  }
}

startTimeInput.addEventListener('input', () => {
  if (!isNaN(parseTime(startTimeInput.value))) {
    updateTimelineUI();
  }
});

endTimeInput.addEventListener('input', () => {
  if (!isNaN(parseTime(endTimeInput.value))) {
    updateTimelineUI();
  }
});

function onHandleDrag(e, handle) {
  e.preventDefault();

  const rect = timelineTrack.getBoundingClientRect();
  let clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;

  let percent = ((clientX - rect.left) / rect.width) * 100;
  percent = clamp(percent, 0, 100);

  if (handle === handleStart) {
    const endPercent = parseFloat(handleEnd.style.left);
    if (percent > endPercent) percent = endPercent;
    handle.style.left = percent + '%';

    const newStartTime = percentToTime(percent);
    startTimeInput.value = formatTime(newStartTime);
  } else if (handle === handleEnd) {
    const startPercent = parseFloat(handleStart.style.left);
    if (percent < startPercent) percent = startPercent;
    handle.style.left = percent + '%';

    const newEndTime = percentToTime(percent);
    endTimeInput.value = formatTime(newEndTime);
  }
  updateTimelineUI();
}

handleStart.addEventListener('mousedown', e => {
  isDraggingStart = true;
  document.body.style.userSelect = 'none';
});
handleEnd.addEventListener('mousedown', e => {
  isDraggingEnd = true;
  document.body.style.userSelect = 'none';
});
document.addEventListener('mouseup', e => {
  if (isDraggingStart || isDraggingEnd) {
    isDraggingStart = false;
    isDraggingEnd = false;
    document.body.style.userSelect = '';
  }
});
document.addEventListener('mousemove', e => {
  if (isDraggingStart) onHandleDrag(e, handleStart);
  if (isDraggingEnd) onHandleDrag(e, handleEnd);
});

// Touch events
handleStart.addEventListener('touchstart', e => {
  isDraggingStart = true;
  document.body.style.userSelect = 'none';
});
handleEnd.addEventListener('touchstart', e => {
  isDraggingEnd = true;
  document.body.style.userSelect = 'none';
});
document.addEventListener('touchend', e => {
  isDraggingStart = false;
  isDraggingEnd = false;
  document.body.style.userSelect = '';
});
document.addEventListener('touchmove', e => {
  if (isDraggingStart) onHandleDrag(e, handleStart);
  if (isDraggingEnd) onHandleDrag(e, handleEnd);
});

// ---------------------------------
// Skip/Rewind buttons logic (+/- 5 seconds)

rewindBtn.addEventListener('click', () => {
  videoPreview.currentTime = Math.max(0, videoPreview.currentTime - 5);
});
forwardBtn.addEventListener('click', () => {
  videoPreview.currentTime = Math.min(videoPreview.duration, videoPreview.currentTime + 5);
});

// ---------------------------------
// Initial state

updateAudioState();
updateTimelineUI();