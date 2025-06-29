export function initTimeline({
  videoElement,
  timelineTrack,  // container for the timeline (multi-track)
  videoTrack,     // video clips track element
  audioTrack,     // audio clips track element
  clipsData,      // array of {startTime, endTime, volume}
  onTimesChanged  // callback: (clipIndex, start, end, volume) => void
}) {
  const clips = [];

  // Get width dynamically on each relevant action (to support resizing)
  function getBaseWidth() {
    const w = timelineTrack.clientWidth;
    if (!w || w < 10) console.warn('timelineTrack width too small:', w);
    return w || 1;
  }

  // Clamp helper
  function clamp(v,min,max){ return Math.min(max,Math.max(min,v)); }

  // Convert time to pixel position based on current width
  function timeToPixels(t){
    const dur = videoElement.duration || 1;
    return (t/dur)*getBaseWidth();
  }

  // Convert pixel position to time
  function pixelsToTime(px){
    const dur = videoElement.duration || 1;
    return (px/getBaseWidth())*dur;
  }

  // Build all clip elements
  function build() {
    videoTrack.innerHTML = '';
    audioTrack.innerHTML = '';
    clips.length = 0;

    clipsData.forEach((data, index) => {
      const container = index === 0 ? videoTrack : audioTrack;
      const clip = document.createElement('div');
      clip.className = 'clip';
      clip.dataset.start = data.startTime;
      clip.dataset.end = data.endTime;

      clip.style.left = `${timeToPixels(data.startTime)}px`;
      clip.style.width = `${timeToPixels(data.endTime) - timeToPixels(data.startTime)}px`;
      clip.style.opacity = 0.5 + 0.5 * data.volume;

      // Create handles
      const hl = document.createElement('div'); hl.className = 'handle-left';
      const hr = document.createElement('div'); hr.className = 'handle-right';

      // Create volume control knob
      const vc = document.createElement('div'); vc.className = 'volume-control';
      const knob = document.createElement('div'); knob.className = 'volume-knob';
      vc.appendChild(knob);

      clip.append(hl, hr, vc);
      container.appendChild(clip);

      clips.push({
        clip, hl, hr, knob, data,
        dragging: false,
        resizingLeft: false,
        resizingRight: false,
        adjustVol: false,
        startX: 0,
        startLeft: 0,
        startWidth: 0,
        startY: 0,
        startTop: 0
      });
    });
  }

  // Update UI from data for a clip object
  function updateClipUI(obj) {
    const left = timeToPixels(obj.data.startTime);
    const right = timeToPixels(obj.data.endTime);
    obj.clip.style.left = `${left}px`;
    obj.clip.style.width = `${right - left}px`;

    const h = obj.clip.clientHeight || 40; // fallback height
    obj.knob.style.top = `${h * (1 - clamp(obj.data.volume, 0, 1))}px`;
    obj.clip.style.opacity = 0.5 + 0.5 * obj.data.volume;
  }

  // Update data from UI for a clip object, fire callback
  function updateData(obj) {
    const left = parseFloat(obj.clip.style.left) || 0;
    const width = parseFloat(obj.clip.style.width) || 0;
    let s = clamp(pixelsToTime(left), 0, videoElement.duration);
    let e = clamp(pixelsToTime(left + width), 0, videoElement.duration);
    if (e <= s) e = s + 0.1;

    obj.data.startTime = s;
    obj.data.endTime = e;

    const h = obj.clip.clientHeight || 40;
    const knobY = obj.knob.offsetTop;
    obj.data.volume = clamp(1 - (knobY / h), 0, 1);

    if (onTimesChanged)
      onTimesChanged(clips.indexOf(obj), s, e, obj.data.volume);
  }

  // Attach mouse events for dragging/resizing/volume knob
  function attachEvents() {
    document.addEventListener('mousemove', e => {
      clips.forEach(o => {
        if (o.dragging) {
          const dx = e.clientX - o.startX;
          let nl = clamp(o.startLeft + dx, 0, getBaseWidth() - o.clip.clientWidth);
          o.clip.style.left = `${nl}px`;
          updateData(o);
        }
        if (o.resizingLeft) {
          const dx = e.clientX - o.startX;
          let nl = o.startLeft + dx;
          let nw = o.startWidth - dx;
          if (nl < 0) { nw += nl; nl = 0; }
          if (nw < 20) { nw = 20; nl = o.startLeft + (o.startWidth - 20); }
          o.clip.style.left = `${nl}px`;
          o.clip.style.width = `${nw}px`;
          updateData(o);
        }
        if (o.resizingRight) {
          const dx = e.clientX - o.startX;
          let nw = o.startWidth + dx;
          const maxW = getBaseWidth() - (parseFloat(o.clip.style.left) || 0);
          if (nw < 20) nw = 20;
          if (nw > maxW) nw = maxW;
          o.clip.style.width = `${nw}px`;
          updateData(o);
        }
        if (o.adjustVol) {
          const dy = e.clientY - o.startY;
          let nt = clamp(o.startTop + dy, 0, o.clip.clientHeight || 40);
          o.knob.style.top = `${nt}px`;
          updateData(o);
        }
      });
    });

    document.addEventListener('mouseup', () => {
      clips.forEach(o => {
        o.dragging = false;
        o.resizingLeft = false;
        o.resizingRight = false;
        o.adjustVol = false;
      });
      document.body.style.userSelect = '';
    });

    clips.forEach(o => {
      o.clip.addEventListener('mousedown', e => {
        if ([o.hl, o.hr, o.knob].includes(e.target)) return;
        o.dragging = true;
        o.startX = e.clientX;
        o.startLeft = parseFloat(o.clip.style.left) || 0;
        document.body.style.userSelect = 'none';
      });
      o.hl.addEventListener('mousedown', e => {
        o.resizingLeft = true;
        o.startX = e.clientX;
        o.startLeft = parseFloat(o.clip.style.left) || 0;
        o.startWidth = parseFloat(o.clip.style.width) || 0;
        document.body.style.userSelect = 'none';
        e.stopPropagation();
      });
      o.hr.addEventListener('mousedown', e => {
        o.resizingRight = true;
        o.startX = e.clientX;
        o.startWidth = parseFloat(o.clip.style.width) || 0;
        document.body.style.userSelect = 'none';
        e.stopPropagation();
      });
      o.knob.addEventListener('mousedown', e => {
        o.adjustVol = true;
        o.startY = e.clientY;
        o.startTop = o.knob.offsetTop;
        document.body.style.userSelect = 'none';
        e.stopPropagation();
      });
    });
  }

  function destroy() {
    timelineTrack.innerHTML = '';
    clips.length = 0;
    // Optionally: remove event listeners here if needed
  }

  // Initialize timeline build and events
  build();
  attachEvents();

  return {
    updateClipUI,
    updateData,
    destroy
  };
}