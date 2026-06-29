const canvas = document.getElementById("signalField");
const context = canvas.getContext("2d");

let width = 0;
let height = 0;
let points = [];

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const count = Math.max(26, Math.floor((width * height) / 36000));
  points = Array.from({ length: count }, (_, index) => ({
    x: (index * 193) % width,
    y: (index * 107) % height,
    vx: (Math.sin(index) + 0.2) * 0.14,
    vy: (Math.cos(index * 1.7) - 0.1) * 0.14,
  }));
}

function draw() {
  context.clearRect(0, 0, width, height);

  points.forEach((point) => {
    point.x += point.vx;
    point.y += point.vy;

    if (point.x < -20) point.x = width + 20;
    if (point.x > width + 20) point.x = -20;
    if (point.y < -20) point.y = height + 20;
    if (point.y > height + 20) point.y = -20;
  });

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const a = points[i];
      const b = points[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 170) {
        const alpha = (1 - distance / 170) * 0.12;
        context.strokeStyle = `rgba(116, 224, 193, ${alpha})`;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      }
    }
  }

  points.forEach((point, index) => {
    context.fillStyle = index % 3 === 0 ? "rgba(216, 200, 143, 0.48)" : "rgba(157, 199, 232, 0.38)";
    context.beginPath();
    context.arc(point.x, point.y, 1.35, 0, Math.PI * 2);
    context.fill();
  });

  requestAnimationFrame(draw);
}

resize();
draw();
window.addEventListener("resize", resize);
