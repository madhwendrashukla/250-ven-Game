import type { GameState, Step } from '../game/types';
import { sfx } from './sfx';

/** Picks the sound for one player move by comparing the state before and after it. */
export function playForStep(prev: GameState, next: GameState, step: Step): void {
  if (next === prev) {
    sfx.error();
    return;
  }
  const fresh = next.log.slice(prev.log.length);
  const kinds = new Set(fresh.map((l) => l.kind));

  if (step.t === 'act') {
    switch (step.a.type) {
      case 'interview':
        sfx.chatter();
        break;
      case 'priceTest':
        sfx.bubble();
        break;
      case 'restock':
        sfx.thud();
        break;
      case 'sell': {
        const sold = next.stats.sold - prev.stats.sold;
        const revenue = next.stats.revenue - prev.stats.revenue;
        if (sold > 0) {
          sfx.coin(sold);
          if (revenue >= 500) sfx.register(0.3);
        } else {
          sfx.error();
        }
        break;
      }
      case 'post':
        if (kinds.has('good')) sfx.sparkle();
        else sfx.whoosh();
        break;
      case 'improve':
        sfx.sparkle();
        break;
      case 'rest':
        sfx.rest();
        break;
      case 'endEarly':
        break;
    }
    if (next.stats.spoiled > prev.stats.spoiled) sfx.bad(0.45);
  } else if (step.t === 'perk') {
    sfx.sparkle();
  } else if (kinds.has('sale')) {
    sfx.coin(8);
  } else if (kinds.has('good')) {
    sfx.good();
  } else if (kinds.has('warn')) {
    sfx.bad();
  } else {
    sfx.click();
  }

  if (next.pendingEvent && !prev.pendingEvent) sfx.chime(0.5);
  if (next.weeks.length > prev.weeks.length) {
    // Week close: the register for a hit target, a groan for a miss, then the paper lands.
    if (next.weeks[next.weeks.length - 1].hit) sfx.register(0.35);
    else sfx.bad(0.35);
    sfx.chime(0.75);
  }
}
