import { processExport, cancelProcessing } from './ffmpeg-logic.js';
import { initTimeline } from './timeline.js';

//
// === UI ELEMENTS ===
//
const videoInput          = document.getElementById('videoInput');
const videoPreview        = document.getElementById('videoPreview');
const multiTracks         = document.querySelector('.timeline-multi-tracks');

const startTimeInput      = document.getElementById('startTime');
const endTimeInput        = document.getElementById('endTime');

const audioBitrateSelect  = document.getElementById('audioBitrateSelect');
const openExportModalBtn  = document.getElementById('openExportModalBtn');
const cancelBtn           = document.getElementById('cancelBtn');
const progressBar         = document.getElementById('progressBar');
const progressText        = document.getElementById('progressText');

const resolutionSelect    = document.getElementById('resolutionSelect');
const qualitySelect       = document.getElementById('qualitySelect');

const playPauseBtn        = document.getElementById('playPauseBtn');
const rewindBtn           = document.getElementById('rewindBtn');
const forwardBtn          = document.getElementById('forwardBtn');

const currentTimeDisplay  = document.getElementById('currentTime');
const totalDurationDisplay= document.getElementById('totalDuration');
const videoProgress       = document.getElementById('videoProgress');

const timelineTrack       = document.querySelector('.timeline-multi-tracks');
const videoTrack          = document.getElementById('videoTrack');
const audioTrack          = document.getElementById('audioTrack');

const importArea          = document.getElementById('importArea');
const fileInput           = document.getElementById('fileInput');

const exportModal         = document.getElementById('exportModal');
const closeExportModalBtn = document.getElementById('closeExportModalBtn');
const confirmExportBtn    = document.getElementById('confirmExportBtn');

let videoFile;
let isDraggingVideoProgress = false;

//
// === MAIN CLIPS DATA ===
//
let clipsData = [];

//
// === SIMPLE HELPERS ===
//
function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${secs}`;
}

function parseTime(str) {
  const p = str.split(':'), m = +p[0], s = +p[1];
  return (p.length === 2 && !isNaN(m) && !isNaN(s) && s < 60) ? m * 60 + s : NaN;
}
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

//
// === IMPORT AREA HANDLING ===
//
importArea.addEventListener('click', () => fileInput.click());
importArea.addEventListener('dragover', e => { e.preventDefault(); importArea.classList.add('dragover'); });
importArea.addEventListener('dragleave', e => { e.preventDefault(); importArea.classList.remove('dragover'); });
importArea.addEventListener('drop', e => {
  e.preventDefault();
  importArea.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => handleFiles(fileInput.files));

function handleFiles(files) {
  if (!files.length) return;
  for (const f of files) {
    if (f.type.startsWith('video/')) {
      videoFile = f;
      videoPreview.src = URL.createObjectURL(f);
      videoPreview.load();

      // Reset clipsData - will fill on loadedmetadata
      clipsData = [];

      videoPreview.onloadedmetadata = () => {
        totalDurationDisplay.textContent = formatTime(videoPreview.duration);
        currentTimeDisplay.textContent = '0:00';
        videoProgress.max = videoPreview.duration;
        videoProgress.value = 0;

        // Initialize clipsData with single full-length clip for main video
        clipsData = [{ startTime: 0, endTime: videoPreview.duration, volume: 1 }];

        rebuildTimeline();
      };

      break;
    }
    if (f.type.startsWith('audio/')) {
      // Only add audio clip if video duration is known
      if (videoPreview.duration) {
        clipsData.push({ startTime: 0, endTime: videoPreview.duration, volume: 1 });
        rebuildTimeline();
      }
    }
  }
}

//
// === EXPORT LOGIC ===
//
openExportModalBtn.addEventListener('click', () => {
  if (!videoFile) return alert('Please upload a video first!');
  exportModal.classList.remove('hidden');
});
closeExportModalBtn.addEventListener('click', () => exportModal.classList.add('hidden'));

confirmExportBtn.addEventListener('click', async () => {
  const start = parseTime(startTimeInput.value),
    end = parseTime(endTimeInput.value),
    dur = videoPreview.duration;
  if (isNaN(start) || isNaN(end) || start >= end || end > dur)
    return alert('Enter valid start/end times within video.');
  exportModal.classList.add('hidden');
  openExportModalBtn.disabled = true;
  cancelBtn.disabled = false;
  openExportModalBtn.textContent = 'Processing...';
  progressBar.style.display = 'block';
  progressText.style.display = 'block';
  progressText.textContent = 'Loading FFmpeg...';

  try {
    await processExport({
      file: videoFile, start, end,
      resolution: resolutionSelect.value,
      quality: qualitySelect.value,
      audioBitrate: audioBitrateSelect.value,
      onProgress: pct => { progressBar.value = pct; progressText.textContent = `Processing: ${pct}%`; },
      onComplete: blobUrl => {
        progressText.textContent = 'Export complete!';
        progressBar.value = 100;
        const a = document.createElement('a');
        a.href = blobUrl; a.download = 'quickcut_output.mp4'; document.body.appendChild(a); a.click();
        a.remove(); URL.revokeObjectURL(blobUrl);
        resetUI();
      },
      onError: err => { alert('Export error: ' + err.message); resetUI(); }
    });
  } catch (e) {
    alert('Unexpected: ' + e.message);
    resetUI();
  }
});
cancelBtn.addEventListener('click', async () => {
  openExportModalBtn.disabled = false; cancelBtn.disabled = true;
  progressText.textContent = 'Cancelling...';
  try { await cancelProcessing(); } catch { }
  resetUI();
});
function resetUI() {
  progressBar.style.display = 'none';
  progressText.style.display = 'none';
  openExportModalBtn.disabled = false;
  cancelBtn.disabled = true;
  openExportModalBtn.textContent = '📤 Export';
}

//
// === PLAYBACK CONTROLS ===
//
playPauseBtn.addEventListener('click', () =>
  videoPreview.paused ? videoPreview.play() : videoPreview.pause()
);
videoPreview.addEventListener('play', () => playPauseBtn.textContent = '⏸️');
videoPreview.addEventListener('pause', () => playPauseBtn.textContent = '▶️');

rewindBtn.addEventListener('click', () =>
  videoPreview.currentTime = Math.max(0, videoPreview.currentTime - 5)
);
forwardBtn.addEventListener('click', () =>
  videoPreview.currentTime = Math.min(videoPreview.duration, videoPreview.currentTime + 5)
);

videoPreview.addEventListener('timeupdate', () => {
  if (!isDraggingVideoProgress) {
    currentTimeDisplay.textContent = formatTime(videoPreview.currentTime);
    videoProgress.value = videoPreview.currentTime;
  }
});
videoProgress.addEventListener('pointerdown', () => isDraggingVideoProgress = true);
videoProgress.addEventListener('input', () => currentTimeDisplay.textContent = formatTime(videoProgress.value));
videoProgress.addEventListener('pointerup', () => { videoPreview.currentTime = videoProgress.value; isDraggingVideoProgress = false; });
videoProgress.addEventListener('pointercancel', () => isDraggingVideoProgress = false);
videoProgress.addEventListener('pointerleave', () => isDraggingVideoProgress = false);

//
// === WHEN VIDEO LOADS, BUILD TIMELINE ===
//
videoPreview.addEventListener('loadedmetadata', () => {
  totalDurationDisplay.textContent = formatTime(videoPreview.duration);
  currentTimeDisplay.textContent = '0:00';
  videoProgress.max = videoPreview.duration;
  videoProgress.value = 0;
  if (clipsData.length === 0) {
    clipsData = [{ startTime: 0, endTime: videoPreview.duration, volume: 1 }];
  }
  rebuildTimeline();
});

//
// === INIT timeline instance ===
//
let tlInstance = null;

function rebuildTimeline() {
  if (tlInstance && tlInstance.destroy) tlInstance.destroy();
  tlInstance = initTimeline({
    videoElement: videoPreview,
    timelineTrack: multiTracks,
    videoTrack,
    audioTrack,
    clipsData,
    onTimesChanged: (idx, start, end, volume) => {
      if (idx === 0) {
        startTimeInput.value = formatTime(start);
        endTimeInput.value = formatTime(end);
      }
      videoPreview.volume = volume;
    }
  });
}