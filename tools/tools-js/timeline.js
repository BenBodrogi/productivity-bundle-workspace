// timeline.js

export function initTimeline({
  videoElement,
  timelineTrack,
  clipsData, // Array of { startTime, endTime, volume }
  onTimesChanged // callback(clipIndex, start, end, volume)
}) {
  const clips = [];

  // Helper clamp
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // Time <-> pixels
  function timeToPixels(time) {
    const duration = videoElement.duration || 1;
    const trackWidth = timelineTrack.clientWidth;
    return (time / duration) * trackWidth;
  }
  function pixelsToTime(px) {
    const duration = videoElement.duration || 1;
    const trackWidth = timelineTrack.clientWidth;
    return (px / trackWidth) * duration;
  }

  // Format/parse time
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

  // Create clip elements dynamically
  clipsData.forEach((clipData, index) => {
    // Create clip container
    const clip = document.createElement('div');
    clip.className = 'clip';
    clip.style.position = 'absolute';

    // Left handle
    const handleLeft = document.createElement('div');
    handleLeft.className = 'handle-left';
    handleLeft.title = 'Trim start';

    // Right handle
    const handleRight = document.createElement('div');
    handleRight.className = 'handle-right';
    handleRight.title = 'Trim end';

    // Audio section with volume knob
    const clipAudio = document.createElement('div');
    clipAudio.className = 'clip-audio';

    const volumeControl = document.createElement('div');
    volumeControl.className = 'volume-control';

    const volumeKnob = document.createElement('div');
    volumeKnob.className = 'volume-knob';
    volumeKnob.title = 'Drag to adjust volume';

    volumeControl.appendChild(volumeKnob);
    clipAudio.appendChild(volumeControl);

    clip.appendChild(handleLeft);
    clip.appendChild(handleRight);
    clip.appendChild(clipAudio);

    timelineTrack.appendChild(clip);

    // Inputs for this clip (start, end) could be dynamic or you provide your own UI externally
    // For now, we’ll keep times in clipData and sync with position/width

    clips.push({
      clip,
      handleLeft,
      handleRight,
      volumeKnob,
      data: clipData,
      isDraggingClip: false,
      isResizingLeft: false,
      isResizingRight: false,
      isAdjustingVolume: false,
      dragStartX: 0,
      clipStartLeft: 0,
      clipStartWidth: 0,
      volumeStartY: 0,
      volumeStartTop: 0
    });
  });

  // Update clip position & size from clip.data
  function updateClipUI(clipObj) {
    const { clip, data } = clipObj;
    const leftPx = timeToPixels(data.startTime);
    const rightPx = timeToPixels(data.endTime);
    const widthPx = rightPx - leftPx;

    clip.style.left = `${leftPx}px`;
    clip.style.width = `${widthPx}px`;

    // Update volume knob position
    const clipHeight = clip.clientHeight;
    const knobPos = clipHeight * (1 - clamp(data.volume, 0, 1));
    clipObj.volumeKnob.style.top = `${knobPos}px`;

    // Optionally style clip opacity based on volume for visual feedback
    clip.style.opacity = 0.5 + 0.5 * data.volume;
  }

  // Convert pixel positions back to times and update clip.data
  function updateClipDataFromUI(clipObj) {
    const { clip, data } = clipObj;
    const leftPx = parseFloat(clip.style.left) || 0;
    const widthPx = parseFloat(clip.style.width) || 0;

    let startTime = clamp(pixelsToTime(leftPx), 0, videoElement.duration);
    let endTime = clamp(pixelsToTime(leftPx + widthPx), 0, videoElement.duration);

    // Avoid invalid ranges
    if (endTime <= startTime) endTime = startTime + 0.1;

    data.startTime = startTime;
    data.endTime = endTime;

    // Volume from knob
    const clipHeight = clip.clientHeight;
    const knobTop = clipObj.volumeKnob.offsetTop;
    data.volume = clamp(1 - (knobTop / clipHeight), 0, 1);

    if (onTimesChanged) {
      onTimesChanged(
        clips.indexOf(clipObj),
        data.startTime,
        data.endTime,
        data.volume
      );
    }
  }

  // Add event listeners for drag/resize/volume per clip
  clips.forEach(clipObj => {
    const { clip, handleLeft, handleRight, volumeKnob } = clipObj;

    // Drag clip
    clip.addEventListener('mousedown', e => {
      if (
        e.target === handleLeft ||
        e.target === handleRight ||
        e.target === volumeKnob
      ) return;
      clipObj.isDraggingClip = true;
      clipObj.dragStartX = e.clientX;
      clipObj.clipStartLeft = parseFloat(clip.style.left) || 0;
      document.body.style.userSelect = 'none';
    });

    // Resize left
    handleLeft.addEventListener('mousedown', e => {
      clipObj.isResizingLeft = true;
      clipObj.dragStartX = e.clientX;
      clipObj.clipStartLeft = parseFloat(clip.style.left) || 0;
      clipObj.clipStartWidth = parseFloat(clip.style.width) || 0;
      document.body.style.userSelect = 'none';
      e.stopPropagation();
    });

    // Resize right
    handleRight.addEventListener('mousedown', e => {
      clipObj.isResizingRight = true;
      clipObj.dragStartX = e.clientX;
      clipObj.clipStartWidth = parseFloat(clip.style.width) || 0;
      document.body.style.userSelect = 'none';
      e.stopPropagation();
    });

    // Adjust volume knob vertically
    volumeKnob.addEventListener('mousedown', e => {
      clipObj.isAdjustingVolume = true;
      clipObj.volumeStartY = e.clientY;
      clipObj.volumeStartTop = volumeKnob.offsetTop;
      document.body.style.userSelect = 'none';
      e.stopPropagation();
    });
  });

  // Global mousemove and mouseup handlers
  document.addEventListener('mousemove', e => {
    clips.forEach(clipObj => {
      const { clip, handleLeft, handleRight, volumeKnob } = clipObj;

      if (clipObj.isDraggingClip) {
        const deltaX = e.clientX - clipObj.dragStartX;
        const newLeft = clamp(clipObj.clipStartLeft + deltaX, 0, timelineTrack.clientWidth - clip.clientWidth);
        clip.style.left = `${newLeft}px`;
        updateClipDataFromUI(clipObj);
      } else if (clipObj.isResizingLeft) {
        const deltaX = e.clientX - clipObj.dragStartX;
        let newLeft = clipObj.clipStartLeft + deltaX;
        let newWidth = clipObj.clipStartWidth - deltaX;

        if (newLeft < 0) {
          newWidth += newLeft;
          newLeft = 0;
        }
        if (newWidth < 20) {
          newWidth = 20;
          newLeft = clipObj.clipStartLeft + (clipObj.clipStartWidth - 20);
        }

        clip.style.left = `${newLeft}px`;
        clip.style.width = `${newWidth}px`;
        updateClipDataFromUI(clipObj);
      } else if (clipObj.isResizingRight) {
        const deltaX = e.clientX - clipObj.dragStartX;
        let newWidth = clipObj.clipStartWidth + deltaX;

        const maxWidth = timelineTrack.clientWidth - (parseFloat(clip.style.left) || 0);
        if (newWidth < 20) newWidth = 20;
        if (newWidth > maxWidth) newWidth = maxWidth;

        clip.style.width = `${newWidth}px`;
        updateClipDataFromUI(clipObj);
      } else if (clipObj.isAdjustingVolume) {
        const deltaY = e.clientY - clipObj.volumeStartY;
        let newTop = clipObj.volumeStartTop + deltaY;
        const clipHeight = clip.clientHeight;
        newTop = clamp(newTop, 0, clipHeight);
        volumeKnob.style.top = `${newTop}px`;

        updateClipDataFromUI(clipObj);
      }
    });
  });

  document.addEventListener('mouseup', () => {
    clips.forEach(clipObj => {
      clipObj.isDraggingClip = false;
      clipObj.isResizingLeft = false;
      clipObj.isResizingRight = false;
      clipObj.isAdjustingVolume = false;
    });
    document.body.style.userSelect = '';
  });

  // Initial update of clips UI
  clips.forEach(updateClipUI);

  // Return an API for external control if needed
  return {
    clipsData,
    updateClipUI,
    updateClipDataFromUI,
  };
}