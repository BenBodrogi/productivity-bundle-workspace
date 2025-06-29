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
// Removed global volumeSlider (optional)
const currentTimeDisplay = document.getElementById('currentTime');
const totalDurationDisplay = document.getElementById('totalDuration');
const previewResolution = document.getElementById('previewResolution');
const videoProgress = document.getElementById('videoProgress');

const timelineTrack = document.querySelector('.timeline-track');

const exportModal = document.getElementById('exportModal');
const closeExportModalBtn = document.getElementById('closeExportModalBtn');
const confirmExportBtn = document.getElementById('confirmExportBtn');

let videoFile;
let isDraggingVideoProgress = false;

// Keep clips data array, add volume for each clip
let clipsData = [
  { startTime: 0, endTime: 10, volume: 1 },
  { startTime: 12, endTime: 20, volume: 0.8 }
];

// Hold timeline instances for each clip
let timelineInstances = [];

// --------- Utility functions (formatTime, parseTime, clamp) remain unchanged ---------

// Clear and build clip elements dynamically inside timelineTrack
function buildClips() {
  timelineTrack.innerHTML = ''; // Clear all

  clipsData.forEach((clip, index) => {
    // Create clip div
    const clipDiv = document.createElement('div');
    clipDiv.classList.add('clip', index === 0 ? 'video-track' : 'audio-track');
    clipDiv.style.position = 'absolute';

    // Create handles
    const handleLeft = document.createElement('div');
    handleLeft.classList.add('handle-left');
    const handleRight = document.createElement('div');
    handleRight.classList.add('handle-right');

    // Create volume knob container & knob for audio clips only
    const volumeControl = document.createElement('div');
    volumeControl.classList.add('volume-control');
    const volumeKnob = document.createElement('div');
    volumeKnob.classList.add('volume-knob');
    volumeControl.appendChild(volumeKnob);

    clipDiv.appendChild(handleLeft);
    clipDiv.appendChild(handleRight);
    clipDiv.appendChild(volumeControl);

    timelineTrack.appendChild(clipDiv);

    // Initialize timeline per clip, pass all these elements
    const timeline = initTimeline({
      videoElement: videoPreview,
      startTimeInput: null, // you can create or manage inputs separately if needed
      endTimeInput: null,
      timelineTrack,
      clipElement: clipDiv,
      handleLeft,
      handleRight,
      volumeKnob,
      onTimesChanged: (start, end, volume) => {
        clipsData[index].startTime = start;
        clipsData[index].endTime = end;
        clipsData[index].volume = volume;
        // If you want, update the video volume accordingly here, or during playback/export
        console.log(`Clip ${index} updated: start=${start}, end=${end}, volume=${volume}`);
      }
    });

    timelineInstances[index] = timeline;

    // Set initial positions & volume
    clipDiv.style.left = `${timeToPixels(clip.startTime)}px`;
    clipDiv.style.width = `${timeToPixels(clip.endTime) - timeToPixels(clip.startTime)}px`;
    timeline.setVolume(clip.volume);
  });
}

// Convert time to pixels helper used above
function timeToPixels(time) {
  const duration = videoPreview.duration || 1;
  const trackWidth = timelineTrack.clientWidth;
  return (time / duration) * trackWidth;
}

// When video metadata loads
videoPreview.addEventListener('loadedmetadata', () => {
  totalDurationDisplay.textContent = formatTime(videoPreview.duration);
  currentTimeDisplay.textContent = formatTime(0);
  videoProgress.max = videoPreview.duration;
  videoProgress.value = 0;

  // Build clip elements and initialize timelines for each clip
  buildClips();
});

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