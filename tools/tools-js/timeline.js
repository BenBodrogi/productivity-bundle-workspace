// timeline.js

export function initTimeline({
  videoElement,
  startTimeInput,
  endTimeInput,
  timelineTrack,
  clipElement,
  handleLeft,
  handleRight,
  volumeKnob,
  onTimesChanged // optional callback(start, end, volume)
}) {
  let isDraggingClip = false;
  let isResizingLeft = false;
  let isResizingRight = false;
  let isAdjustingVolume = false;

  let dragStartX = 0;
  let clipStartLeft = 0;  // px
  let clipStartWidth = 0;  // px
  let volumeStartY = 0;
  let volumeStartHeight = 0; // px

  // Helper: clamp between min and max
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // Convert time (seconds) to pixel left offset inside timeline track
  function timeToPixels(time) {
    const duration = videoElement.duration || 1;
    const trackWidth = timelineTrack.clientWidth;
    return (time / duration) * trackWidth;
  }

  // Convert pixels offset to time (seconds)
  function pixelsToTime(px) {
    const duration = videoElement.duration || 1;
    const trackWidth = timelineTrack.clientWidth;
    return (px / trackWidth) * duration;
  }

  // Format time seconds -> "m:ss"
  function formatTime(sec) {
    if (isNaN(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // Parse "m:ss" -> seconds
  function parseTime(str) {
    const parts = str.split(':');
    if (parts.length !== 2) return NaN;
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (isNaN(m) || isNaN(s) || s >= 60 || m < 0 || s < 0) return NaN;
    return m * 60 + s;
  }

  // Update clip position and width from start/end inputs
  function updateClipFromInputs() {
    const startTime = clamp(parseTime(startTimeInput.value), 0, videoElement.duration);
    const endTime = clamp(parseTime(endTimeInput.value), 0, videoElement.duration);
    if (endTime <= startTime) return; // invalid range

    const leftPx = timeToPixels(startTime);
    const rightPx = timeToPixels(endTime);
    const widthPx = rightPx - leftPx;

    clipElement.style.left = `${leftPx}px`;
    clipElement.style.width = `${widthPx}px`;
  }

  // Update inputs from clip position and size
  function updateInputsFromClip() {
    const leftPx = parseFloat(clipElement.style.left) || 0;
    const widthPx = parseFloat(clipElement.style.width) || 0;

    const startTime = clamp(pixelsToTime(leftPx), 0, videoElement.duration);
    const endTime = clamp(pixelsToTime(leftPx + widthPx), 0, videoElement.duration);

    startTimeInput.value = formatTime(startTime);
    endTimeInput.value = formatTime(endTime);

    if (onTimesChanged) onTimesChanged(startTime, endTime, getVolume());
  }

  // Volume knob logic

  // Get volume (0..1) from knob vertical position relative to clip
  function getVolume() {
    const clipHeight = clipElement.clientHeight;
    const knobTop = volumeKnob.offsetTop;
    // Invert: top=0 volume=1, bottom=clipHeight volume=0
    return clamp(1 - (knobTop / clipHeight), 0, 1);
  }

  // Set volume knob vertical position based on volume 0..1
  function setVolume(volume) {
    const clipHeight = clipElement.clientHeight;
    const knobPos = clipHeight * (1 - clamp(volume, 0, 1));
    volumeKnob.style.top = `${knobPos}px`;

    if (onTimesChanged) {
      const startTime = parseTime(startTimeInput.value);
      const endTime = parseTime(endTimeInput.value);
      onTimesChanged(startTime, endTime, volume);
    }
  }

  // -----------------------
  // Event Handlers

  // Drag entire clip
  clipElement.addEventListener('mousedown', e => {
    if (e.target === handleLeft || e.target === handleRight || e.target === volumeKnob) return;
    isDraggingClip = true;
    dragStartX = e.clientX;
    clipStartLeft = parseFloat(clipElement.style.left) || 0;
    document.body.style.userSelect = 'none';
  });

  // Resize left handle
  handleLeft.addEventListener('mousedown', e => {
    isResizingLeft = true;
    dragStartX = e.clientX;
    clipStartLeft = parseFloat(clipElement.style.left) || 0;
    clipStartWidth = parseFloat(clipElement.style.width) || 0;
    document.body.style.userSelect = 'none';
    e.stopPropagation();
  });

  // Resize right handle
  handleRight.addEventListener('mousedown', e => {
    isResizingRight = true;
    dragStartX = e.clientX;
    clipStartWidth = parseFloat(clipElement.style.width) || 0;
    document.body.style.userSelect = 'none';
    e.stopPropagation();
  });

  // Drag volume knob vertically
  volumeKnob.addEventListener('mousedown', e => {
    isAdjustingVolume = true;
    volumeStartY = e.clientY;
    volumeStartHeight = volumeKnob.offsetTop;
    document.body.style.userSelect = 'none';
    e.stopPropagation();
  });

  // Mouse move handler
  document.addEventListener('mousemove', e => {
    if (isDraggingClip) {
      const deltaX = e.clientX - dragStartX;
      const newLeft = clamp(clipStartLeft + deltaX, 0, timelineTrack.clientWidth - clipElement.clientWidth);
      clipElement.style.left = `${newLeft}px`;
      updateInputsFromClip();
    } else if (isResizingLeft) {
      const deltaX = e.clientX - dragStartX;
      let newLeft = clipStartLeft + deltaX;
      let newWidth = clipStartWidth - deltaX;

      // Clamp so clip doesn't invert or go outside timeline
      if (newLeft < 0) {
        newWidth += newLeft;
        newLeft = 0;
      }
      if (newWidth < 20) {
        newWidth = 20;
        newLeft = clipStartLeft + (clipStartWidth - 20);
      }

      clipElement.style.left = `${newLeft}px`;
      clipElement.style.width = `${newWidth}px`;
      updateInputsFromClip();
    } else if (isResizingRight) {
      const deltaX = e.clientX - dragStartX;
      let newWidth = clipStartWidth + deltaX;

      // Clamp max width so clip doesn't overflow timeline
      const maxWidth = timelineTrack.clientWidth - (parseFloat(clipElement.style.left) || 0);
      if (newWidth < 20) newWidth = 20;
      if (newWidth > maxWidth) newWidth = maxWidth;

      clipElement.style.width = `${newWidth}px`;
      updateInputsFromClip();
    } else if (isAdjustingVolume) {
      const deltaY = e.clientY - volumeStartY;
      let newTop = volumeStartHeight + deltaY;
      // Clamp volume knob within clip height
      const clipHeight = clipElement.clientHeight;
      newTop = clamp(newTop, 0, clipHeight);
      volumeKnob.style.top = `${newTop}px`;

      // Notify volume change
      if (onTimesChanged) {
        const startTime = parseTime(startTimeInput.value);
        const endTime = parseTime(endTimeInput.value);
        const volume = getVolume();
        onTimesChanged(startTime, endTime, volume);
      }
    }
  });

  // Mouse up - stop any dragging
  document.addEventListener('mouseup', () => {
    if (isDraggingClip || isResizingLeft || isResizingRight || isAdjustingVolume) {
      isDraggingClip = false;
      isResizingLeft = false;
      isResizingRight = false;
      isAdjustingVolume = false;
      document.body.style.userSelect = '';
    }
  });

  // Sync inputs changes back to clip position/size
  startTimeInput.addEventListener('input', () => {
    updateClipFromInputs();
  });
  endTimeInput.addEventListener('input', () => {
    updateClipFromInputs();
  });

  // Initial setup
  updateClipFromInputs();
  setVolume(1); // full volume initially

  return {
    updateClipFromInputs,
    updateInputsFromClip,
    setVolume,
    getVolume
  };
}