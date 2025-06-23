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

let videoFile = null;
let isCancelled = false;

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
  if (isNaN(m) || isNaN(s) || s >= 60 || m < 0 || s < 0) return NaN;
  return m * 60 + s;
}

function resetUI() {
  progressBar.style.display = 'none';
  progressText.style.display = 'none';
  exportBtn.disabled = false;
  cancelBtn.disabled = true;
  exportBtn.textContent = '📤 Export';
  isCancelled = false;
}

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
  };
});

exportBtn.addEventListener('click', () => {
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

  const mute = muteAudioCheckbox.checked || volumeSlider.value == 0;
  const resolution = resolutionSelect.value;
  const quality = qualitySelect.value;
  const audioBitrate = audioBitrateSelect.value;

  isCancelled = false;
  exportBtn.disabled = true;
  cancelBtn.disabled = false;
  exportBtn.textContent = 'Processing...';
  progressBar.style.display = 'block';
  progressBar.value = 0;
  progressText.style.display = 'block';
  progressText.textContent = 'Loading FFmpeg...';

  processExport({
    file: videoFile,
    start,
    end,
    resolution,
    quality,
    mute,
    audioBitrate,
    onProgress: (percent) => {
      if (isCancelled) return;
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
    onError: (err) => {
      if (!isCancelled) {
        alert('Error during export: ' + err.message);
        resetUI();
      }
    },
  });
});

cancelBtn.addEventListener('click', async () => {
  if (isCancelled) return;
  isCancelled = true;

  progressText.textContent = 'Cancelling... Please wait.';
  exportBtn.disabled = false;
  cancelBtn.disabled = true;

  await cancelProcessing();
  resetUI();
});

// Play/Pause button logic
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

// Volume and mute sync
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

muteToggleBtn.addEventListener('click', () => {
  const wasMuted = videoPreview.muted;
  videoPreview.muted = !wasMuted;
  muteAudioCheckbox.checked = videoPreview.muted;
  volumeSlider.value = videoPreview.muted ? 0 : videoPreview.volume;
  muteToggleBtn.textContent = wasMuted ? '🔈' : '🔇';
  audioBitrateSelect.disabled = videoPreview.muted;
});

// Video time update and slider sync
videoPreview.addEventListener('timeupdate', () => {
  currentTimeDisplay.textContent = formatTime(videoPreview.currentTime);
  videoProgress.value = videoPreview.currentTime;
});

videoProgress.addEventListener('input', () => {
  currentTimeDisplay.textContent = formatTime(videoProgress.value);
});

videoProgress.addEventListener('change', () => {
  videoPreview.currentTime = videoProgress.value;
});

// Rewind and Forward buttons
rewindBtn.addEventListener('click', () => {
  videoPreview.currentTime = Math.max(0, videoPreview.currentTime - 5);
});
forwardBtn.addEventListener('click', () => {
  videoPreview.currentTime = Math.min(videoPreview.duration, videoPreview.currentTime + 5);
});

// Preview resolution dropdown
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
  videoPreview.style.filter = 'none'; // remove blur if any
});
