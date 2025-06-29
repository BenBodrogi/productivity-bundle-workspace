import { processExport, cancelProcessing } from './ffmpeg-logic.js';
import { initTimeline } from './timeline.js';

const videoInput = document.getElementById('videoInput');
const videoPreview = document.getElementById('videoPreview');

const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');

const audioBitrateSelect = document.getElementById('audioBitrateSelect');
const openExportModalBtn = document.getElementById('openExportModalBtn');
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
const clipElement = document.querySelector('.clip');
const handleLeft = document.querySelector('.handle-left');
const handleRight = document.querySelector('.handle-right');
const volumeKnob = document.querySelector('.volume-knob');

const exportModal = document.getElementById('exportModal');
const closeExportModalBtn = document.getElementById('closeExportModalBtn');
const confirmExportBtn = document.getElementById('confirmExportBtn');

let videoFile;
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
  openExportModalBtn.disabled = false;  // enabled main export button
  cancelBtn.disabled = true;
  openExportModalBtn.textContent = '📤 Export';
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

    // Update timeline clip based on inputs and video duration
    timeline.updateClipFromInputs();
    // Reset volume knob to full volume on load
    timeline.setVolume(1);
  };
});

// ---------------------------------
// Export modal open/close

openExportModalBtn.addEventListener('click', () => {
  if (!videoFile) {
    alert('Please upload a video first!');
    return;
  }
  exportModal.classList.remove('hidden');
});

closeExportModalBtn.addEventListener('click', () => {
  exportModal.classList.add('hidden');
});

// ---------------------------------
// Export confirm button logic

confirmExportBtn.addEventListener('click', async () => {
  const start = parseTime(startTimeInput.value);
  const end = parseTime(endTimeInput.value);
  const videoDuration = videoPreview.duration;

  if (isNaN(start) || isNaN(end) || start >= end || end > videoDuration) {
    alert('Please enter valid start and end times (start < end and within video length).');
    return;
  }

  const resolution = resolutionSelect.value;
  const quality = qualitySelect.value;
  const audioBitrate = audioBitrateSelect.value;

  exportModal.classList.add('hidden');

  openExportModalBtn.disabled = true;
  cancelBtn.disabled = false;
  openExportModalBtn.textContent = 'Processing...';
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

// ---------------------------------
// Cancel button logic

cancelBtn.addEventListener('click', async () => {
  openExportModalBtn.disabled = false;
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

// --------------------------------
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
// Skip/Rewind buttons logic (+/- 5 seconds)

rewindBtn.addEventListener('click', () => {
  videoPreview.currentTime = Math.max(0, videoPreview.currentTime - 5);
});
forwardBtn.addEventListener('click', () => {
  videoPreview.currentTime = Math.min(videoPreview.duration, videoPreview.currentTime + 5);
});

// ---------------------------------
// Volume slider sync

volumeSlider.addEventListener('input', () => {
  videoPreview.volume = volumeSlider.value;
  // Optionally sync volume knob here, if you want
});
videoPreview.volume = volumeSlider.value;

// ---------------------------------
// Initialize timeline

const timeline = initTimeline({
  videoElement: videoPreview,
  startTimeInput,
  endTimeInput,
  timelineTrack,
  clipElement,
  handleLeft,
  handleRight,
  volumeKnob,
  onTimesChanged: (start, end, volume) => {
    // update your video element volume and time inputs accordingly
    videoPreview.volume = volume;
    startTimeInput.value = formatTime(start);
    endTimeInput.value = formatTime(end);
  }
});