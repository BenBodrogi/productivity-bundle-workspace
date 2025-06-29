import { processExport, cancelProcessing } from './ffmpeg-logic.js';

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
const volumeSlider = document.getElementById('volumeSlider');

const currentTimeDisplay = document.getElementById('currentTime');
const totalDurationDisplay = document.getElementById('totalDuration');

const previewResolution = document.getElementById('previewResolution');
const videoProgress = document.getElementById('videoProgress');

const timelineTrack = document.querySelector('.timeline-track');
const timelineFill = document.querySelector('.timeline-fill');
const handleStart = document.querySelector('.handle-start');
const handleEnd = document.querySelector('.handle-end');

const openExportModalBtn = document.getElementById('openExportModal');
const exportModal = document.getElementById('exportModal');
const closeExportModalBtn = document.getElementById('closeExportModal');

let videoFile;
let isDraggingStart = false;
let isDraggingEnd = false;
let isDraggingVideoProgress = false;

// ---------------------------------
// Time helpers
function formatTime(sec) {
  if (isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function parseTime(str) {
  const parts = str.split(':');
  if (parts.length !== 2) return NaN;
  const m = parseInt(parts[0], 10);
  const s = parseInt(parts[1], 10);
  return isNaN(m) || isNaN(s) || s >= 60 || m < 0 || s < 0 ? NaN : m * 60 + s;
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
// Export Modal logic
openExportModalBtn.addEventListener('click', () => {
  exportModal.style.display = 'block';
});
closeExportModalBtn.addEventListener('click', () => {
  exportModal.style.display = 'none';
});

// ---------------------------------
// Load video
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
// Export logic
exportBtn.addEventListener('click', async () => {
  if (!videoFile) {
    alert('Please upload a video first!');
    return;
  }

  const start = parseTime(startTimeInput.value);
  const end = parseTime(endTimeInput.value);
  const videoDuration = videoPreview.duration;

  if (isNaN(start) || isNaN(end) || start >= end || end > videoDuration) {
    alert('Please enter valid start and end times.');
    return;
  }

  const mute = muteAudioCheckbox.checked;
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
        progressText.textContent = 'Export complete!';
        progressBar.value = 100;

        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = 'quickcut_output.mp4';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);

        resetUI();
        exportModal.style.display = 'none';
      },
      onError: (error) => {
        alert('Error: ' + error.message);
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
// Play controls
playPauseBtn.addEventListener('click', () => {
  videoPreview.paused ? videoPreview.play() : videoPreview.pause();
});
videoPreview.addEventListener('play', () => {
  playPauseBtn.textContent = '⏸️';
});
videoPreview.addEventListener('pause', () => {
  playPauseBtn.textContent = '▶️';
});

// ---------------------------------
// Volume slider only (no mute button anymore)
volumeSlider.addEventListener('input', () => {
  videoPreview.volume = volumeSlider.value;
  videoPreview.muted = volumeSlider.value == 0;
});

// ---------------------------------
// Time + progress slider sync
videoPreview.addEventListener('timeupdate', () => {
  if (!isDraggingVideoProgress) {
    currentTimeDisplay.textContent = formatTime(videoPreview.currentTime);
    videoProgress.value = videoPreview.currentTime;
  }
});
videoProgress.addEventListener('pointerdown', () => isDraggingVideoProgress = true);
videoProgress.addEventListener('input', () => {
  currentTimeDisplay.textContent = formatTime(videoProgress.value);
});
videoProgress.addEventListener('pointerup', () => {
  videoPreview.currentTime = videoProgress.value;
  isDraggingVideoProgress = false;
});

// ---------------------------------
// Preview resolution dropdown
previewResolution.addEventListener('change', () => {
  const val = previewResolution.value;
  const [w, h] = val === 'original' ? [null, null] : val.split('x');
  if (w && h) {
    videoPreview.width = parseInt(w);
    videoPreview.height = parseInt(h);
  } else {
    videoPreview.removeAttribute('width');
    videoPreview.removeAttribute('height');
  }
});

// ---------------------------------
// Timeline & draggable handles
function updateTimelineUI() {
  const startSec = clamp(parseTime(startTimeInput.value), 0, videoPreview.duration);
  const endSec = clamp(parseTime(endTimeInput.value), 0, videoPreview.duration);
  const startPercent = timeToPercent(startSec);
  const endPercent = timeToPercent(endSec);

  timelineFill.style.left = `${startPercent}%`;
  timelineFill.style.width = `${endPercent - startPercent}%`;
  handleStart.style.left = `${startPercent}%`;
  handleEnd.style.left = `${endPercent}%`;
}

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
    startTimeInput.value = formatTime(percentToTime(percent));
  } else {
    const startPercent = parseFloat(handleStart.style.left);
    if (percent < startPercent) percent = startPercent;
    handle.style.left = percent + '%';
    endTimeInput.value = formatTime(percentToTime(percent));
  }

  updateTimelineUI();
}

handleStart.addEventListener('mousedown', () => isDraggingStart = true);
handleEnd.addEventListener('mousedown', () => isDraggingEnd = true);
document.addEventListener('mouseup', () => {
  isDraggingStart = false;
  isDraggingEnd = false;
});
document.addEventListener('mousemove', e => {
  if (isDraggingStart) onHandleDrag(e, handleStart);
  if (isDraggingEnd) onHandleDrag(e, handleEnd);
});

// ---------------------------------
// Rewind/Forward
rewindBtn.addEventListener('click', () => {
  videoPreview.currentTime = Math.max(0, videoPreview.currentTime - 5);
});
forwardBtn.addEventListener('click', () => {
  videoPreview.currentTime = Math.min(videoPreview.duration, videoPreview.currentTime + 5);
});

// ---------------------------------
// Initialize
updateTimelineUI();
videoPreview.volume = volumeSlider.value;
