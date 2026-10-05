// Step-through controls shared by diagrams. The runtime wires them up; without JS the full diagram stays visible.
export function player(steps) {
  return `<div class="player" data-steps="${steps}">
<button type="button" data-act="prev" aria-label="Previous step">‹</button>
<button type="button" data-act="play" aria-label="Play">▶</button>
<button type="button" data-act="next" aria-label="Next step">›</button>
<span class="count">${steps} steps</span>
<span class="caption" aria-live="polite">Press ▶ or › to walk through it.</span>
</div>`;
}
