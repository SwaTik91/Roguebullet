export const SPEEDS = [1, 2, 3, 4];

export function nextSpeed(current) {
  const index = SPEEDS.indexOf(current);
  return SPEEDS[(index + 1) % SPEEDS.length];
}

export function speedLabel(current) {
  return `×${current}`;
}
