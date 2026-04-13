/**
 * Mirror Engine — Generates personality insights, Johari maps, challenge cards,
 * compatibility insights, and reflection prompts from raw mirror rating data.
 *
 * No AI API calls. All insights are computed algorithmically from gap patterns
 * and rendered through a large template bank grounded in Johari Window psychology.
 */

// ─── Types ──────────────────────────────────────────────────────────

export type Dimension = 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'stability'

export interface TraitScore {
  dimension: Dimension
  selfScore: number
  groupAvg: number
  gap: number          // groupAvg - selfScore (positive = blind spot, negative = mask)
  raterCount: number
  consensus: number    // std deviation among raters (lower = stronger agreement)
}

export type JohariQuadrant = 'arena' | 'blind_spot' | 'mask' | 'unknown'

export interface JohariMapping {
  dimension: Dimension
  quadrant: JohariQuadrant
  gap: number
}

export interface HiddenStrength {
  dimension: Dimension
  gap: number
  insight: string
}

export interface MaskInsight {
  dimension: Dimension
  gap: number
  insight: string
}

export interface ChallengeCard {
  dimension: Dimension
  direction: 'blind_spot' | 'mask'
  challenge: string
}

export interface ReflectionPrompt {
  dimension: Dimension
  question: string
}

export interface PlayerPortrait {
  playerName: string
  playerId: string
  traits: TraitScore[]
  jopiMap: JohariMapping[]
  role: PersonalityRole
  hiddenStrengths: HiddenStrength[]
  masks: MaskInsight[]
  challengeCard: ChallengeCard
  reflectionPrompt: ReflectionPrompt
  headline: string
  selfAwarenessScore: number  // 0-100, how aligned self vs group
}

export interface PersonalityRole {
  name: string
  emoji: string
  description: string
}

export interface CompatibilityPair {
  player1: string
  player2: string
  alignment: number    // 0-100
  strongestBond: string
  biggestDifference: string
  friendshipFuel: string
}

export interface BiggestSurprise {
  playerName: string
  dimension: Dimension
  selfScore: number
  groupAvg: number
  gap: number
  insight: string
  whatItMeans: string
}

export interface GroupHotTake {
  text: string
  stat: string
}

export interface SessionReport {
  portraits: PlayerPortrait[]
  compatibility: CompatibilityPair[]
  biggestSurprise: BiggestSurprise
  hotTake: GroupHotTake
  groupRoles: { playerName: string; role: PersonalityRole }[]
}

// ─── Raw Rating Input ───────────────────────────────────────────────

export interface RawRating {
  subject_player_id: string
  rater_player_id: string | null  // null = self-rating
  question_id: string
  dimension: Dimension
  score: number
}

export interface PlayerInfo {
  id: string
  name: string
}

// ─── Trait Adjectives ───────────────────────────────────────────────

const TRAIT_ADJ: Record<Dimension, { high: string; low: string; noun: string }> = {
  openness:          { high: 'adventurous',   low: 'routine-loving', noun: 'openness to experience' },
  conscientiousness: { high: 'organized',     low: 'spontaneous',    noun: 'conscientiousness' },
  extraversion:      { high: 'outgoing',      low: 'reserved',       noun: 'extraversion' },
  agreeableness:     { high: 'empathetic',    low: 'independent',    noun: 'agreeableness' },
  stability:         { high: 'calm',          low: 'intense',        noun: 'emotional stability' },
}

const TRAIT_FRIENDLY: Record<Dimension, string> = {
  openness: 'openness',
  conscientiousness: 'reliability',
  extraversion: 'social energy',
  agreeableness: 'empathy',
  stability: 'calmness',
}

// ─── Compute Trait Scores ───────────────────────────────────────────

export function computeTraitScores(
  ratings: RawRating[],
  playerId: string
): TraitScore[] {
  const byDimension = new Map<Dimension, { self: number[]; group: number[] }>()

  for (const r of ratings) {
    if (r.subject_player_id !== playerId) continue
    const entry = byDimension.get(r.dimension) || { self: [], group: [] }
    if (r.rater_player_id === null) {
      entry.self.push(r.score)
    } else {
      entry.group.push(r.score)
    }
    byDimension.set(r.dimension, entry)
  }

  const traits: TraitScore[] = []
  for (const [dim, data] of byDimension) {
    const selfScore = data.self.length > 0 ? mean(data.self) : 4 // neutral fallback
    const groupAvg = data.group.length > 0 ? mean(data.group) : selfScore
    const gap = round1(groupAvg - selfScore)
    const consensus = data.group.length > 1 ? stdDev(data.group) : 0
    traits.push({
      dimension: dim as Dimension,
      selfScore: round1(selfScore),
      groupAvg: round1(groupAvg),
      gap,
      raterCount: data.group.length,
      consensus: round1(consensus),
    })
  }

  return traits
}

// ─── Johari Mapping ─────────────────────────────────────────────────

export function computeJohariMap(traits: TraitScore[]): JohariMapping[] {
  return traits.map((t) => ({
    dimension: t.dimension,
    quadrant: getQuadrant(t),
    gap: t.gap,
  }))
}

function getQuadrant(t: TraitScore): JohariQuadrant {
  const absGap = Math.abs(t.gap)
  if (absGap <= 0.8) return 'arena'       // aligned: both see it
  if (t.gap > 0.8) return 'blind_spot'     // friends see more than you do
  return 'mask'                             // you see more than friends do
}

// ─── Roles ──────────────────────────────────────────────────────────

const ROLES: { test: (t: TraitScore[]) => boolean; role: PersonalityRole }[] = [
  {
    test: (t) => highestTrait(t) === 'extraversion' && gapFor(t, 'extraversion') > 1.0,
    role: { name: 'The Spark', emoji: '⚡', description: 'Lights up every room without even knowing it' },
  },
  {
    test: (t) => highestTrait(t) === 'agreeableness' && avgGap(t) < 0.8,
    role: { name: 'The Glue', emoji: '🤝', description: 'Holds the group together and everyone knows it' },
  },
  {
    test: (t) => highestTrait(t) === 'openness' && biggestAbsGap(t) > 1.5,
    role: { name: 'The Wildcard', emoji: '🎲', description: 'Full of surprises, even to themselves' },
  },
  {
    test: (t) => highestTrait(t) === 'conscientiousness',
    role: { name: 'The Anchor', emoji: '⚓', description: 'The one everyone counts on when it matters' },
  },
  {
    test: (t) => highestTrait(t) === 'stability',
    role: { name: 'The Rock', emoji: '🪨', description: 'Unshakeable. The calm in every storm.' },
  },
  {
    test: (t) => avgGap(t) < 0.5,
    role: { name: 'The Mirror', emoji: '🪞', description: 'Sees themselves exactly as others see them. Rare.' },
  },
  {
    test: (t) => highestTrait(t) === 'extraversion',
    role: { name: 'The Spark', emoji: '⚡', description: 'Brings the energy wherever they go' },
  },
  {
    test: (t) => highestTrait(t) === 'openness',
    role: { name: 'The Explorer', emoji: '🧭', description: 'Always curious, always trying something new' },
  },
  {
    test: () => true, // fallback
    role: { name: 'The Original', emoji: '✨', description: 'Doesn\'t fit a box. That\'s the point.' },
  },
]

export function assignRole(traits: TraitScore[]): PersonalityRole {
  for (const { test, role } of ROLES) {
    if (test(traits)) return role
  }
  return ROLES[ROLES.length - 1].role
}

// ─── Hidden Strengths (Blind Spots) ─────────────────────────────────

const BLIND_SPOT_TEMPLATES: Record<Dimension, string[]> = {
  openness: [
    "Your friends see you as significantly more adventurous than you see yourself. Three people independently said the same thing. You might be dismissing a real ability as 'not a big deal.' It is.",
    "You rated your curiosity lower than your friends did. They see someone who explores, questions, and tries new things. You might just call it 'normal.' They call it inspiring.",
  ],
  conscientiousness: [
    "Your friends trust you more than you trust yourself. They rated your reliability {gap} points higher than you did. When you say you'll do something, people believe you. That's not common.",
    "You think you're less organized than your friends think you are. The gap suggests you've built systems so natural to you that you don't even notice them anymore.",
  ],
  extraversion: [
    "Your friends see someone who lights up a room. You rated yourself {gap} points lower. The energy you bring is more visible to others than it is to you. They notice. Every time.",
    "You underestimate your social impact. Your friends rated your social energy significantly higher. The conversations you start, the laughs you trigger, they see all of it.",
  ],
  agreeableness: [
    "Your friends see you as more empathetic than you see yourself. That {gap}-point gap means you're probably doing emotional labor you don't even register as work.",
    "You rated your agreeableness lower than your friends did. Translation: you think you're tougher than they think you are. They see the kindness you think you're hiding.",
  ],
  stability: [
    "Your friends see you as calmer under pressure than you feel. That inner chaos you experience? It doesn't leak out as much as you think. A {gap}-point gap means your composure is real, even if it doesn't feel like it.",
    "You think you're more stressed than you appear. Your friends rated your calmness {gap} points higher. Whatever your coping mechanism is, it's working.",
  ],
}

function getHiddenStrengths(traits: TraitScore[]): HiddenStrength[] {
  return traits
    .filter((t) => t.gap > 0.8)
    .sort((a, b) => b.gap - a.gap)
    .map((t) => {
      const templates = BLIND_SPOT_TEMPLATES[t.dimension]
      const template = templates[Math.floor(Math.random() * templates.length)]
      return {
        dimension: t.dimension,
        gap: t.gap,
        insight: template.replace(/\{gap\}/g, String(Math.abs(t.gap))),
      }
    })
}

// ─── Masks ──────────────────────────────────────────────────────────

const MASK_TEMPLATES: Record<Dimension, string[]> = {
  openness: [
    "You see yourself as more adventurous than your friends do. Maybe you're adventurous in ways they haven't seen yet. Or maybe the gap is worth exploring.",
    "You rated your openness higher than your friends did. This could mean you're adventurous in private but play it safe in groups. The gap is the question, not the answer.",
  ],
  conscientiousness: [
    "You think you're more organized than your friends perceive. Either you're hiding your chaos well, or your standards are higher than theirs. Both are interesting.",
    "Your friends see you as slightly less reliable than you see yourself. It might not be about follow-through. It might be about communication. Do they know you came through?",
  ],
  extraversion: [
    "You rate yourself as more outgoing than your friends see you. You might be an extrovert who hasn't found the right stage yet. Or someone whose energy shows up differently than expected.",
    "There's a gap between how social you feel and how social you appear. That's not a flaw. Some people's warmth is quieter. Your friends might just need to look closer.",
  ],
  agreeableness: [
    "You see yourself as more agreeable than your friends do. That could mean you're conflict-averse in your head but direct in practice. That's actually a strength.",
    "Your friends see you as slightly tougher than you see yourself. You might think you're accommodating. They see someone with a backbone. That's not a bad thing.",
  ],
  stability: [
    "You rate yourself as calmer than your friends see you. The stress might be leaking more than you think. Not a judgment. Just data worth having.",
    "Your friends perceive more intensity than you feel. Some of what you experience as normal energy reads as stress to others. Worth knowing, not worth changing unless you want to.",
  ],
}

function getMasks(traits: TraitScore[]): MaskInsight[] {
  return traits
    .filter((t) => t.gap < -0.8)
    .sort((a, b) => a.gap - b.gap)
    .map((t) => {
      const templates = MASK_TEMPLATES[t.dimension]
      const template = templates[Math.floor(Math.random() * templates.length)]
      return {
        dimension: t.dimension,
        gap: t.gap,
        insight: template.replace(/\{gap\}/g, String(Math.abs(t.gap))),
      }
    })
}

// ─── Challenge Cards ────────────────────────────────────────────────

const CHALLENGE_TEMPLATES: Record<Dimension, { blind_spot: string[]; mask: string[] }> = {
  openness: {
    blind_spot: [
      "This week, pick one thing you've been curious about but haven't tried. Book it. Your friends already see you as the adventurous one.",
      "Next time someone suggests something weird, say yes first, think later. Your friends see an explorer. Let yourself see it too.",
      "Try cooking something you've never made before this week. No recipe you already know. Your friends see creativity you're not using.",
    ],
    mask: [
      "This week, try the familiar option instead of the new one. Just once. See if comfort has its own kind of adventure.",
      "Ask a friend to pick the restaurant, the movie, the plan. Let someone else's taste surprise you.",
    ],
  },
  conscientiousness: {
    blind_spot: [
      "Next time someone thanks you for being reliable, don't deflect. Just say 'thanks.' You earned it.",
      "Write down three things you organized this week without being asked. Your friends see this. Now you can too.",
      "The next time you catch yourself saying 'I should be more organized,' remember: your friends rated you {gap} points higher than you rated yourself. You're already there.",
    ],
    mask: [
      "Try leaving one thing unfinished this week on purpose. See how it feels. Sometimes 'good enough' is the real skill.",
      "Ask someone if they actually needed that thing you stayed up late finishing. You might be over-delivering where nobody asked.",
    ],
  },
  extraversion: {
    blind_spot: [
      "This week, notice when you make a room laugh. Don't deflect it, just notice. Your friends already see this. You just need to catch up.",
      "Start one conversation with a stranger this week. Coffee shop, elevator, anywhere. Your friends already see you as someone who connects. Trust them.",
      "Next time you're at a gathering, count how many people come to talk to YOU. Not who you approach. Who approaches you. Your friends see a magnet.",
    ],
    mask: [
      "Try spending an evening alone this week, no plans, no screens for the first hour. See what comes up. Solitude has its own energy.",
      "Next group hangout, try listening more than talking. Notice what you hear differently.",
    ],
  },
  agreeableness: {
    blind_spot: [
      "Notice when you put someone else's comfort before your own this week. Don't stop doing it. Just notice. Your empathy is a feature, not a bug.",
      "The next time someone vents to you, notice how you feel afterward. Your emotional labor is real. Your friends see it. Now protect it.",
    ],
    mask: [
      "Try saying 'no' to one thing this week without explaining why. See how it feels. Your friends already respect your boundaries more than you think.",
      "Next disagreement, let yourself disagree out loud. Your friends see someone with conviction. Let yourself be that person.",
    ],
  },
  stability: {
    blind_spot: [
      "Next time you feel stressed, check: is the stress showing on your face? Ask someone. You might be calmer than you feel. Your friends think so.",
      "The next crisis at work or home, notice how you respond in the first 30 seconds. Your friends rated you as calm under pressure. Watch yourself prove them right.",
    ],
    mask: [
      "Try naming your stress out loud this week. 'I'm stressed about X.' Your friends can't support what they can't see.",
      "Next time you say 'I'm fine,' check if you actually are. Your friends might see more than you're sharing. That's not weakness. That's connection.",
    ],
  },
}

function getChallengeCard(traits: TraitScore[]): ChallengeCard {
  // Pick the trait with the biggest absolute gap
  const sorted = [...traits].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
  const top = sorted[0]
  if (!top) {
    return { dimension: 'openness', direction: 'blind_spot', challenge: 'Try something new this week. Anything. See what happens.' }
  }

  const direction: 'blind_spot' | 'mask' = top.gap > 0 ? 'blind_spot' : 'mask'
  const templates = CHALLENGE_TEMPLATES[top.dimension][direction]
  const challenge = templates[Math.floor(Math.random() * templates.length)]
    .replace(/\{gap\}/g, String(Math.abs(top.gap)))

  return { dimension: top.dimension, direction, challenge }
}

// ─── Reflection Prompts ─────────────────────────────────────────────

const REFLECTION_TEMPLATES: Record<Dimension, { blind_spot: string[]; mask: string[] }> = {
  openness: {
    blind_spot: [
      "If your friends see you as creative and you don't, what definition of 'creative' are you using? Is it possible your definition is too narrow?",
      "Your friends see an explorer. You see someone ordinary. Who's wrong? Or is it possible you've normalized your own curiosity?",
    ],
    mask: [
      "You see yourself as more open than your friends do. Are there adventures happening in your head that you haven't shared with the world yet?",
      "Is there a version of adventurous that doesn't require leaving your comfort zone? What would that look like?",
    ],
  },
  conscientiousness: {
    blind_spot: [
      "If your friends see you as reliable and you don't, what standard are you holding yourself to? Whose voice is that standard in?",
      "You rated yourself as less organized than your friends did. Is it possible that what feels like chaos to you looks like competence to everyone else?",
    ],
    mask: [
      "You think you're more disciplined than your friends see. Where does discipline cross into rigidity? Is there a cost you're not counting?",
      "If reliability matters to you more than it matters to your friends, what does that gap mean? Whose expectations are you meeting?",
    ],
  },
  extraversion: {
    blind_spot: [
      "Your friends see you as more social than you feel. Where did you learn to downplay your own energy? Was it useful once? Is it still?",
      "If three friends independently say you light up a room and you disagree, what evidence would change YOUR mind?",
    ],
    mask: [
      "You see yourself as more outgoing than your friends perceive. Is there a difference between wanting connection and showing it? Where does the signal get lost?",
      "Is it possible your social energy shows up in ways your friends don't recognize as 'outgoing'? What would it look like if you showed it differently?",
    ],
  },
  agreeableness: {
    blind_spot: [
      "Your friends see more empathy than you give yourself credit for. What would change if you acknowledged that empathy as a skill instead of a default?",
      "If your kindness is invisible to you but visible to everyone else, what are you not seeing? And why?",
    ],
    mask: [
      "You see yourself as more agreeable than your friends do. Is that who you are, or who you think you should be? There's a difference.",
      "Your friends see someone with stronger opinions than you think you have. What would happen if you trusted their perception?",
    ],
  },
  stability: {
    blind_spot: [
      "You rate yourself as more stressed than you appear. Is that inner turbulence real, or is it a story you've told yourself so long it feels like truth?",
      "Your friends see calm. You feel chaos. If both are true, what does that make you? Resilient, maybe.",
    ],
    mask: [
      "You think you're calmer than your friends see. Is that armor, or awareness? And does the answer change what you do about it?",
      "If your stress is more visible than you intended, is that a problem to fix or a wall to lower?",
    ],
  },
}

function getReflectionPrompt(traits: TraitScore[]): ReflectionPrompt {
  const sorted = [...traits].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
  const top = sorted[0]
  if (!top) {
    return { dimension: 'openness', question: 'What would your friends say about you that you\'d be surprised to hear?' }
  }

  const direction: 'blind_spot' | 'mask' = top.gap > 0 ? 'blind_spot' : 'mask'
  const templates = REFLECTION_TEMPLATES[top.dimension][direction]
  return {
    dimension: top.dimension,
    question: templates[Math.floor(Math.random() * templates.length)],
  }
}

// ─── Headlines ──────────────────────────────────────────────────────

function getHeadline(traits: TraitScore[], name: string): string {
  const biggestBlindSpot = traits.filter((t) => t.gap > 1.5).sort((a, b) => b.gap - a.gap)[0]
  const biggestMask = traits.filter((t) => t.gap < -1.5).sort((a, b) => a.gap - b.gap)[0]
  const mostAligned = traits.filter((t) => Math.abs(t.gap) < 0.5).length

  if (mostAligned >= 4) {
    return `${name} sees themselves almost exactly as others see them. That's rare.`
  }
  if (biggestBlindSpot && biggestBlindSpot.gap > 2.0) {
    const adj = TRAIT_ADJ[biggestBlindSpot.dimension].high
    return `${name}'s friends see someone more ${adj} than ${name} does. The gap is ${biggestBlindSpot.gap} points.`
  }
  if (biggestMask && biggestMask.gap < -2.0) {
    const adj = TRAIT_ADJ[biggestMask.dimension].high
    return `${name} thinks they're more ${adj} than their friends see. Interesting gap.`
  }
  if (biggestBlindSpot) {
    return `${name} has a hidden strength in ${TRAIT_FRIENDLY[biggestBlindSpot.dimension]} that their friends see clearly.`
  }
  return `${name}'s mirror reveals a mix of alignment and surprise. The details tell the story.`
}

// ─── Self-Awareness Score ───────────────────────────────────────────

function selfAwarenessScore(traits: TraitScore[]): number {
  if (traits.length === 0) return 50
  const avgAbsGap = mean(traits.map((t) => Math.abs(t.gap)))
  // Scale: 0 gap = 100, 3+ gap = 0
  return Math.max(0, Math.min(100, Math.round(100 - (avgAbsGap / 3) * 100)))
}

// ─── Compatibility ──────────────────────────────────────────────────

const BOND_TEMPLATES: Record<Dimension, string> = {
  openness: "You both see the world with the same sense of adventure",
  conscientiousness: "You can count on each other. That's the foundation.",
  extraversion: "Your social energies match. Conversations just flow.",
  agreeableness: "You get each other emotionally. That's not common.",
  stability: "You handle pressure the same way. That's calming for both of you.",
}

const DIFF_TEMPLATES: Record<Dimension, string> = {
  openness: "One pulls toward adventure, the other toward comfort. That's not friction, that's balance.",
  conscientiousness: "One plans, one wings it. The best trips happen when both show up.",
  extraversion: "One charges from people, one charges from solitude. You take turns filling each other up.",
  agreeableness: "One says yes, one pushes back. Together you make better decisions than either would alone.",
  stability: "One stays calm, one feels deeply. Between you, nothing gets missed.",
}

const FUEL_TEMPLATES: Record<string, string[]> = {
  high: [
    "This is one of those friendships where you finish each other's sentences. Protect it.",
    "You two are tuned to the same frequency. When one of you is off, the other feels it.",
    "The alignment here is unusually high. You probably make decisions together without realizing it.",
  ],
  medium: [
    "You complement each other in the ways that matter. The differences keep things interesting.",
    "Strong enough alignment to trust each other, different enough to keep each other sharp.",
  ],
  low: [
    "You see the world differently. That's not a problem. It's the reason this friendship teaches you things others can't.",
    "The gap between you two is where the growth happens. Different perspectives, same team.",
  ],
}

export function computeCompatibility(
  players: PlayerInfo[],
  allTraits: Map<string, TraitScore[]>
): CompatibilityPair[] {
  const pairs: CompatibilityPair[] = []

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = allTraits.get(players[i].id) ?? []
      const b = allTraits.get(players[j].id) ?? []

      if (a.length === 0 || b.length === 0) continue

      // Compute per-dimension alignment
      let totalAlignment = 0
      let count = 0
      let strongestDim: Dimension = 'openness'
      let strongestVal = -1
      let weakestDim: Dimension = 'openness'
      let weakestVal = 999

      for (const ta of a) {
        const tb = b.find((x) => x.dimension === ta.dimension)
        if (!tb) continue
        const alignment = 1 - Math.abs(ta.groupAvg - tb.groupAvg) / 6
        totalAlignment += alignment
        count++
        if (alignment > strongestVal) { strongestVal = alignment; strongestDim = ta.dimension }
        if (alignment < weakestVal) { weakestVal = alignment; weakestDim = ta.dimension }
      }

      const overallAlignment = count > 0 ? Math.round((totalAlignment / count) * 100) : 50
      const tier = overallAlignment >= 75 ? 'high' : overallAlignment >= 50 ? 'medium' : 'low'
      const fuelPool = FUEL_TEMPLATES[tier]

      pairs.push({
        player1: players[i].name,
        player2: players[j].name,
        alignment: overallAlignment,
        strongestBond: BOND_TEMPLATES[strongestDim],
        biggestDifference: DIFF_TEMPLATES[weakestDim],
        friendshipFuel: fuelPool[Math.floor(Math.random() * fuelPool.length)],
      })
    }
  }

  // Sort by alignment descending
  pairs.sort((a, b) => b.alignment - a.alignment)
  return pairs
}

// ─── Biggest Surprise ───────────────────────────────────────────────

export function findBiggestSurprise(
  players: PlayerInfo[],
  allTraits: Map<string, TraitScore[]>
): BiggestSurprise {
  let biggest: { player: PlayerInfo; trait: TraitScore } | null = null

  for (const p of players) {
    const traits = allTraits.get(p.id) ?? []
    for (const t of traits) {
      if (!biggest || Math.abs(t.gap) > Math.abs(biggest.trait.gap)) {
        biggest = { player: p, trait: t }
      }
    }
  }

  if (!biggest) {
    return {
      playerName: players[0]?.name ?? 'Someone',
      dimension: 'openness',
      selfScore: 4,
      groupAvg: 4,
      gap: 0,
      insight: 'No big surprises tonight. This group knows each other well.',
      whatItMeans: 'High alignment across the board. That\'s rare and worth celebrating.',
    }
  }

  const { player, trait } = biggest
  const direction = trait.gap > 0 ? 'blind_spot' : 'mask'
  const adj = TRAIT_ADJ[trait.dimension]

  const insight = direction === 'blind_spot'
    ? `${player.name} rated themselves ${trait.selfScore} on ${TRAIT_FRIENDLY[trait.dimension]}. Their friends said ${trait.groupAvg}. They don't see it. Everyone else does.`
    : `${player.name} rated themselves ${trait.selfScore} on ${TRAIT_FRIENDLY[trait.dimension]}. Their friends said ${trait.groupAvg}. There's a story in that gap.`

  const whatItMeans = direction === 'blind_spot'
    ? `In the Johari Window, this is a Blind Spot. ${player.name} has a strength in ${TRAIT_FRIENDLY[trait.dimension]} that's invisible to them but obvious to everyone around them. That's the kind of thing that changes how you see yourself, if you let it.`
    : `In the Johari Window, this is a Mask. ${player.name} projects more ${adj.high} energy than their friends perceive. The gap isn't good or bad. It's information.`

  return {
    playerName: player.name,
    dimension: trait.dimension,
    selfScore: trait.selfScore,
    groupAvg: trait.groupAvg,
    gap: trait.gap,
    insight,
    whatItMeans,
  }
}

// ─── Group Hot Take ─────────────────────────────────────────────────

export function generateHotTake(
  players: PlayerInfo[],
  allTraits: Map<string, TraitScore[]>
): GroupHotTake {
  // Find the dimension with the biggest average gap across the group
  const dimGaps = new Map<Dimension, number[]>()
  for (const [, traits] of allTraits) {
    for (const t of traits) {
      const gaps = dimGaps.get(t.dimension) || []
      gaps.push(t.gap)
      dimGaps.set(t.dimension, gaps)
    }
  }

  let biggestDim: Dimension = 'extraversion'
  let biggestAvgGap = 0
  for (const [dim, gaps] of dimGaps) {
    const avg = mean(gaps)
    if (Math.abs(avg) > Math.abs(biggestAvgGap)) {
      biggestAvgGap = round1(avg)
      biggestDim = dim as Dimension
    }
  }

  const direction = biggestAvgGap > 0 ? 'underestimates' : 'overestimates'
  const adj = TRAIT_ADJ[biggestDim]
  const absGap = round1(Math.abs(biggestAvgGap))

  // Count how many players have blind spots vs masks
  const blindSpotCount = players.filter((p) => {
    const traits = allTraits.get(p.id) ?? []
    return traits.filter((t) => t.gap > 0.8).length > traits.filter((t) => t.gap < -0.8).length
  }).length

  const templates = [
    `This group collectively ${direction} themselves on ${TRAIT_FRIENDLY[biggestDim]} by ${absGap} points. You are, statistically, ${direction === 'underestimates' ? 'more' : 'less'} ${adj.high} than you think you are.`,
    `${blindSpotCount} out of ${players.length} people in this room have hidden strengths they don't see. The mirror sees them.`,
    `The average self-awareness gap in this group is ${absGap} points on ${TRAIT_FRIENDLY[biggestDim]}. That's ${absGap > 1.5 ? 'a significant blind spot' : 'a notable gap'}. ${direction === 'underestimates' ? 'You\'re all better than you think.' : 'Interesting.'}`,
  ]

  return {
    text: templates[Math.floor(Math.random() * templates.length)],
    stat: `${absGap} point average gap on ${TRAIT_FRIENDLY[biggestDim]}`,
  }
}

// ─── Full Portrait Generation ───────────────────────────────────────

export function generatePortrait(
  player: PlayerInfo,
  ratings: RawRating[],
): PlayerPortrait {
  const traits = computeTraitScores(ratings, player.id)
  const johariMap = computeJohariMap(traits)
  const role = assignRole(traits)
  const hiddenStrengths = getHiddenStrengths(traits)
  const masks = getMasks(traits)
  const challengeCard = getChallengeCard(traits)
  const reflectionPrompt = getReflectionPrompt(traits)
  const headline = getHeadline(traits, player.name)
  const saScore = selfAwarenessScore(traits)

  return {
    playerName: player.name,
    playerId: player.id,
    traits,
    jopiMap: johariMap,
    role,
    hiddenStrengths,
    masks,
    challengeCard,
    reflectionPrompt,
    headline,
    selfAwarenessScore: saScore,
  }
}

// ─── Full Session Report ────────────────────────────────────────────

export function generateSessionReport(
  players: PlayerInfo[],
  ratings: RawRating[],
): SessionReport {
  const portraits = players.map((p) => generatePortrait(p, ratings))
  const allTraits = new Map<string, TraitScore[]>()
  for (const p of portraits) {
    allTraits.set(p.playerId, p.traits)
  }

  const compatibility = computeCompatibility(players, allTraits)
  const biggestSurprise = findBiggestSurprise(players, allTraits)
  const hotTake = generateHotTake(players, allTraits)
  const groupRoles = portraits.map((p) => ({ playerName: p.playerName, role: p.role }))

  return {
    portraits,
    compatibility,
    biggestSurprise,
    hotTake,
    groupRoles,
  }
}

// ─── Utilities ──────────────────────────────────────────────────────

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function highestTrait(traits: TraitScore[]): Dimension {
  return [...traits].sort((a, b) => b.groupAvg - a.groupAvg)[0]?.dimension ?? 'openness'
}

function gapFor(traits: TraitScore[], dim: Dimension): number {
  return traits.find((t) => t.dimension === dim)?.gap ?? 0
}

function biggestAbsGap(traits: TraitScore[]): number {
  return Math.max(...traits.map((t) => Math.abs(t.gap)), 0)
}

function avgGap(traits: TraitScore[]): number {
  return mean(traits.map((t) => Math.abs(t.gap)))
}
