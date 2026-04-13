export function getAdaptiveRevealDelay(cardIndex: number, totalCards: number): number {
  if (cardIndex === totalCards - 1) return 2500
  if (cardIndex >= totalCards - 3) return 1500
  return 800
}
