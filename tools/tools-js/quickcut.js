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
const durationInfo        = document.getElementById('durationInfo');

const resolutionSelect    = document.getElementById('resolutionSelect');
const qualitySelect       = document.getElementById('qualitySelect');

const playPauseBtn        = document.getElementById('playPauseBtn');
const rewindBtn           = document.getElementById('rewindBtn');
const forwardBtn          = document.getElementById('forwardBtn');

const currentTimeDisplay  = document.getElementById('currentTime');
const totalDurationDisplay= document.getElementById('totalDuration');
const previewResolution   = document.getElementById('previewResolution');
const videoProgress       = document.getElementById('videoProgress');
const volumeSlider        = document.getElementById('volumeSlider');

const timelineTrack       = document.querySelector('.timeline-track');
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
let clipsData = [
  { startTime: 0,  endTime: 10, volume: 1 },   // main video clip
  { startTime: 12, endTime: 20, volume: 0.8 }  // an audio clip
];

//
// === SIMPLE HELPERS ===
//
function formatTime(sec) {
  if (isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec/60), s = Math.floor(sec%60);
  return `${m}:${s.toString().padStart(2,'0')}`;
}
function parseTime(str) {
  const p = str.split(':'), m = +p[0], s = +p[1];
  return (p.length===2 && !isNaN(m)&&!isNaN(s)&&s<60) ? m*60+s : NaN;
}
function clamp(v,min,max){ return Math.min(max,Math.max(min,v)); }

//
// === IMPORT AREA HANDLING ===
//
importArea.addEventListener('click', () => fileInput.click());
importArea.addEventListener('dragover', e => { e.preventDefault(); importArea.classList.add('dragover'); });
importArea.addEventListener('dragleave', e => { e.preventDefault(); importArea.classList.remove('dragover'); });
importArea.addEventListener('drop', e => {
  e.preventDefault(); importArea.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => handleFiles(fileInput.files));

function showVideoThumbnail(file) {
  // Clear previous content
  previewThumbnail.innerHTML = '';

  // Create a hidden video element to extract the first frame
  const vid = document.createElement('video');
  vid.src = URL.createObjectURL(file);
  vid.muted = true;
  vid.playsInline = true;
  vid.autoplay = false;  // don't autoplay here
  vid.controls = false;
  vid.style.display = 'none'; // hide it

  // Append hidden video to the DOM so it can load metadata and seek
  document.body.appendChild(vid);

  vid.addEventListener('loadedmetadata', () => {
    // Set video currentTime to 0 to get first frame
    vid.currentTime = 0;
  });

  vid.addEventListener('seeked', () => {
    // Create canvas and draw first frame
    const canvas = document.createElement('canvas');
    canvas.width = vid.videoWidth;
    canvas.height = vid.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);

    // Create image from canvas
    const img = document.createElement('img');
    img.src = canvas.toDataURL();
    img.alt = 'Video thumbnail';

    // Clear previewThumbnail and add the image
    previewThumbnail.innerHTML = '';
    previewThumbnail.appendChild(img);
    previewThumbnail.style.display = 'block';

    // Clean up hidden video element
    document.body.removeChild(vid);

    // Clicking thumbnail loads video into main preview
    previewThumbnail.onclick = () => {
      videoPreview.src = vid.src;
      videoPreview.load();
    };
  });

  // In case the video fails to load or seek, remove hidden video after some timeout
  setTimeout(() => {
    if (document.body.contains(vid)) {
      document.body.removeChild(vid);
    }
  }, 5000);
}

function handleFiles(files) {
  if (!files.length) return;
  for (const f of files) {
    if (f.type.startsWith('video/')) {
      videoFile = f;
      videoPreview.src = URL.createObjectURL(f);
      videoPreview.load();

      clipsData = [];

      videoPreview.onloadedmetadata = () => {
        clipsData = [{ startTime: 0, endTime: videoPreview.duration, volume: 1 }];
        rebuildTimeline();
      };

      showVideoThumbnail(f);  // Show preview below drag area

      break;
    }
    if (f.type.startsWith('audio/')) {
      clipsData.push({ startTime: 0, endTime: videoPreview.duration || 10, volume: 1 });
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
        end   = parseTime(endTimeInput.value),
        dur   = videoPreview.duration;
  if (isNaN(start)||isNaN(end)||start>=end||end>dur)
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
      onProgress: pct => { progressBar.value=pct; progressText.textContent=`Processing: ${pct}%`; },
      onComplete: blobUrl => {
        progressText.textContent = 'Export complete!';
        progressBar.value = 100;
        const a = document.createElement('a');
        a.href = blobUrl; a.download='quickcut_output.mp4'; document.body.appendChild(a); a.click();
        a.remove(); URL.revokeObjectURL(blobUrl);
        resetUI();
      },
      onError: err => { alert('Export error: '+err.message); resetUI(); }
    });
  } catch(e) {
    alert('Unexpected: '+e.message);
    resetUI();
  }
});
cancelBtn.addEventListener('click', async () => {
  openExportModalBtn.disabled=false; cancelBtn.disabled=true;
  progressText.textContent='Cancelling...';
  try { await cancelProcessing(); } catch{} 
  resetUI();
});
function resetUI(){
  progressBar.style.display='none';
  progressText.style.display='none';
  openExportModalBtn.disabled=false;
  cancelBtn.disabled=true;
  openExportModalBtn.textContent='📤 Export';
}

//
// === PLAYBACK CONTROLS ===
//
playPauseBtn.addEventListener('click', () =>
  videoPreview.paused ? videoPreview.play() : videoPreview.pause()
);
videoPreview.addEventListener('play', () => playPauseBtn.textContent='⏸️');
videoPreview.addEventListener('pause',() => playPauseBtn.textContent='▶️');

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
videoProgress.addEventListener('pointerdown',()=>isDraggingVideoProgress=true);
videoProgress.addEventListener('input',()=>currentTimeDisplay.textContent=formatTime(videoProgress.value));
videoProgress.addEventListener('pointerup', ()=>{ videoPreview.currentTime=videoProgress.value; isDraggingVideoProgress=false; });
videoProgress.addEventListener('pointercancel',()=>isDraggingVideoProgress=false);
videoProgress.addEventListener('pointerleave',()=>isDraggingVideoProgress=false);

previewResolution.addEventListener('change', ()=>{
  const v=previewResolution.value;
  if(v!=='original') {
    const [w,h]=v.split('x').map(n=>+n);
    videoPreview.width=w; videoPreview.height=h;
  } else {
    videoPreview.removeAttribute('width'); videoPreview.removeAttribute('height');
  }
});

//
// === WHEN VIDEO LOADS, BUILD TIMELINE ===
//
videoPreview.addEventListener('loadedmetadata', () =>{
  totalDurationDisplay.textContent = formatTime(videoPreview.duration);
  currentTimeDisplay.textContent = '0:00';
  videoProgress.max = videoPreview.duration;
  videoProgress.value = 0;
  rebuildTimeline();
});

//
// === TIE INTO timeline.js ===
//
let tlInstance = null;
function rebuildTimeline(){
  // clear out any old instance
  if(tlInstance && tlInstance.destroy) tlInstance.destroy();
  tlInstance = initTimeline({
    videoElement: videoPreview,
    timelineTrack: multiTracks,
    videoTrack,
    audioTrack,
    clipsData,
    onTimesChanged: (idx,start,end,volume)=>{
      // keep main start/end inputs in sync with clip 0
      if(idx===0){
        startTimeInput.value = formatTime(start);
        endTimeInput.value   = formatTime(end);
      }
      videoPreview.volume = volume;
    }
  });
}