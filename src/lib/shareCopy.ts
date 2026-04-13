// Viral share-copy generator for badges, session stories and other artifacts.
// Every template embeds: player/host name, badge identity, a boastable stat,
// and a challenge link back to the game — the four ingredients that make a
// share feel "flex-worthy" instead of generic.

import type { PlayerBadge } from './badgeLogic'

export interface BadgeShareContext {
  playerName: string
  badge: PlayerBadge
  roomCode?: string
  totalRounds?: number
  appUrl?: string          // e.g. https://social-mirror.vercel.app
}

function stripInvalidFilenameChars(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'Social Mirror'
}

// Filename convention for ALL artifacts:
//   Social Mirror-<kind>-<Person>-<Detail>.png
// Meaningful + unique enough to not collide in the user's Downloads folder.
export function badgeFileName(playerName: string, badge: PlayerBadge): string {
  const person = stripInvalidFilenameChars(playerName)
  const name = stripInvalidFilenameChars(badge.name.replace(/^The\s+/i, ''))
  return `Social Mirror-Badge-${person}-${name}.png`
}

export function sessionStoryFileName(hostName: string, roomCode: string): string {
  const person = stripInvalidFilenameChars(hostName)
  const room = stripInvalidFilenameChars(roomCode)
  const date = new Date().toISOString().slice(0, 10)
  return `Social Mirror-Game-${person}-${room}-${date}.png`
}

// Per-badge viral hook — each one plays to the badge's personality.
// Returns the body text; caller prepends/appends the challenge URL.
function badgeHook(ctx: BadgeShareContext): string {
  const { playerName, badge } = ctx
  const rank = badge.rank && badge.totalPlayers ? `#${badge.rank} of ${badge.totalPlayers}` : null
  const exact = badge.bestDistance === 0

  switch (badge.name) {
    case 'The Baba Vanga':
      return `${playerName} just got called 🔮 The Baba Vanga in Social Mirror.\nPredicted strangers' answers DOWN TO THE NUMBER.${rank ? ` Finished ${rank}.` : ''}\nThink you can read minds too?`
    case 'The Virat Kohli':
      return `${playerName} went full 🔥 Virat Kohli in Social Mirror — won three rounds in a row like every point was personal.${rank ? ` Finished ${rank}.` : ''}\nTry to beat this streak.`
    case 'The MS Dhoni':
      return `🏏 ${playerName} = MS Dhoni in Social Mirror. Cool head, closest guess, finished it every single time.${rank ? ` Came in ${rank}.` : ''}\nThink you're calmer under pressure?`
    case 'The Salman Khan':
      return `${playerName} earned the 🕶️ Salman Khan badge in Social Mirror — broke every rule of the game and somehow still won. Bhai things.\nCome try to beat it.`
    case 'The Aamir Khan':
      return `${playerName} is officially 🎬 The Aamir Khan of Social Mirror — took forever, got every answer right. Perfectionist certified.${rank ? ` Finished ${rank}.` : ''}`
    case 'The Mogambo':
      return `Nobody could crack ${playerName} in Social Mirror tonight. 🕵️ The Mogambo badge earned.\nMogambo khush hua. Think YOU can guess what they're thinking? [link]`
    case 'The SRK':
      return `🌟 ${playerName} was THE main character in Social Mirror tonight — the whole room was guessing about them. Obviously.\nHost your own and see who becomes the SRK of your group.`
    case 'The Arnab Goswami':
      return `🎙️ The nation demanded an answer from ${playerName} in Social Mirror. They answered. Loudly. Wrongly. But FAST.\nThink you're faster?`
    case 'The Ambani':
      return `💰 ${playerName} guessed in crores while everyone else guessed in normal numbers. The Ambani of Social Mirror has spoken.\nChallenge their vibe.`
    case 'The Hardik Pandya':
      return `⚡ No plan. Just vibes. Somehow right.\n${playerName} just earned The Hardik Pandya badge in Social Mirror.${rank ? ` Finished ${rank}.` : ''}\nCan YOUR vibes match?`
    case 'The Gabbar Singh':
      return `😬 "Kitne aadmi the?" ${playerName} was still completely wrong.\nThe Gabbar Singh of Social Mirror has been crowned. Come laugh with them.`
    case 'The Devdas':
      return `👻 ${playerName} passed so many rounds in Social Mirror they got called The Devdas. Present. Suffering. Uninvolved.\nTag them. They deserve it.`
    case 'The Babu Bhaiya':
      return `🤷 Haan... nahi... pata nahi.\n${playerName} just earned the 🤷 Babu Bhaiya badge in Social Mirror — wrong every single time. Iconic.\nCome be wrong with them.`
    default:
      return `${playerName} just earned ${badge.emoji} ${badge.name} in Social Mirror.${exact ? ' Got an answer EXACTLY right.' : ''}${rank ? ` Finished ${rank}.` : ''}`
  }
}

export function badgeShareText(ctx: BadgeShareContext): string {
  const hook = badgeHook(ctx)
  const link = ctx.appUrl ?? 'https://social-mirror.vercel.app'
  return `${hook}\n\n🎯 Play Social Mirror: ${link}`
}

export function badgeShareTitle(ctx: BadgeShareContext): string {
  return `${ctx.playerName} · ${ctx.badge.emoji} ${ctx.badge.name}`
}

export interface SessionShareContext {
  hostName: string
  roomCode: string
  playerCount: number
  roundsPlayed: number
  winnerName?: string
  winnerPoints?: number
  appUrl?: string
}

export function sessionStoryShareText(ctx: SessionShareContext): string {
  const link = ctx.appUrl ?? 'https://social-mirror.vercel.app'
  const winnerLine = ctx.winnerName
    ? `🏆 ${ctx.winnerName} won with ${ctx.winnerPoints ?? 0} pts.`
    : ''
  return `🎯 ${ctx.hostName} just ran a Social Mirror night — ${ctx.playerCount} players, ${ctx.roundsPlayed} rounds of mind-reading chaos.\n${winnerLine}\n\nHost your own group: ${link}`
}

export function sessionStoryShareTitle(ctx: SessionShareContext): string {
  return `${ctx.hostName}'s Social Mirror game · Room ${ctx.roomCode}`
}
