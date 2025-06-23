const numDots = 20;
const body = document.body;
let dots = [];

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function createDot() {
  const dot = document.createElement('div');
  dot.classList.add('floating-dot');

  const size = randomRange(6, 14);
  dot.style.width = size + 'px';
  dot.style.height = size + 'px';

  dot.style.top = randomRange(0, window.innerHeight) + 'px';
  dot.style.left = randomRange(0, window.innerWidth) + 'px';

  dot.dataset.startX = parseFloat(dot.style.left);
  dot.dataset.startY = parseFloat(dot.style.top);
  dot.dataset.amplitudeX = randomRange(10, 40);
  dot.dataset.amplitudeY = randomRange(10, 40);
  dot.dataset.speed = randomRange(0.002, 0.006) / 4;
  dot.dataset.phase = Math.random() * Math.PI * 2;

  body.appendChild(dot);
  return dot;
}

function toggleBubbles(enabled) {
  if (enabled && dots.length === 0) {
    dots = Array.from({ length: numDots }, createDot);
    animateDots();
  } else if (!enabled && dots.length) {
    dots.forEach(dot => dot.remove());
    dots = [];
  }
}

function animateDots(time = 0) {
  dots.forEach(dot => {
    const { speed, amplitudeX, amplitudeY, phase, startX, startY } = dot.dataset;
    const x = parseFloat(startX) + Math.sin(time * speed + parseFloat(phase)) * parseFloat(amplitudeX);
    const y = parseFloat(startY) + Math.cos(time * speed + parseFloat(phase)) * parseFloat(amplitudeY);
    dot.style.transform = `translate(${x - startX}px, ${y - startY}px)`;
    dot.style.opacity = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * speed * 1.5 + parseFloat(phase)));
  });

  if (dots.length > 0) requestAnimationFrame(animateDots);
}
