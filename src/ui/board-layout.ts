// Display geometry only. Positions 0–30 still belong to the unchanged engine.
export const trackPath =
  "M85 590 C40 530 60 420 155 405 C255 388 315 470 420 465 C535 460 575 365 505 305 C440 250 280 320 195 270 C55 190 125 85 255 95 C400 105 415 195 555 190 C660 185 650 75 775 90 C935 110 925 300 800 310 C710 320 655 300 650 390 C645 495 800 440 870 500 C955 580 850 665 745 620 C685 592 630 580 590 625";
const curves = [
  [40, 530, 60, 420, 155, 405],
  [255, 388, 315, 470, 420, 465],
  [535, 460, 575, 365, 505, 305],
  [440, 250, 280, 320, 195, 270],
  [55, 190, 125, 85, 255, 95],
  [400, 105, 415, 195, 555, 190],
  [660, 185, 650, 75, 775, 90],
  [935, 110, 925, 300, 800, 310],
  [710, 320, 655, 300, 650, 390],
  [645, 495, 800, 440, 870, 500],
  [955, 580, 850, 665, 745, 620],
  [685, 592, 630, 580, 590, 625],
];
const samples = [{ x: 85, y: 590, distance: 0 }];
let start = { x: 85, y: 590 };
for (const [x1, y1, x2, y2, x3, y3] of curves) {
  for (let i = 1; i <= 80; i++) {
    const t = i / 80,
      u = 1 - t;
    const x =
      u * u * u * start.x +
      3 * u * u * t * x1 +
      3 * u * t * t * x2 +
      t * t * t * x3;
    const y =
      u * u * u * start.y +
      3 * u * u * t * y1 +
      3 * u * t * t * y2 +
      t * t * t * y3;
    const last = samples[samples.length - 1];
    samples.push({
      x,
      y,
      distance: last.distance + Math.hypot(x - last.x, y - last.y),
    });
  }
  start = { x: x3, y: y3 };
}
export function trackPoint(position: number) {
  const distance =
    (Math.max(0, Math.min(30, position)) / 30) *
    samples[samples.length - 1].distance;
  let lo = 0,
    hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].distance < distance) lo = mid + 1;
    else hi = mid;
  }
  const b = samples[lo],
    a = samples[Math.max(0, lo - 1)];
  const t =
    b.distance === a.distance
      ? 0
      : (distance - a.distance) / (b.distance - a.distance);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
