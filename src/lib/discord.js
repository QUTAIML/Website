// Live details about the AIML Discord, read once when the site is built.
// Discord's public invite endpoint returns the member and online counts.
// If Discord can't be reached, the page falls back to the figure in site.json,
// so a Discord outage never breaks the build.

import { links, site } from "@/lib/content";

const EMOJI = { brain: "🧠", mechanical_arm: "🦾", handshake: "🤝", busts_in_silhouette: "👥", mortar_board: "🎓", robot: "🤖", computer: "💻", rocket: "🚀", books: "📚", sparkles: "✨" };

let cached;

export function getDiscord() {
  cached ??= load();
  return cached;
}

async function load() {
  const code = links.discord.split("/").filter(Boolean).at(-1);
  const fallbackMembers = site.stats?.find(stat => /discord/i.test(stat.label))?.value ?? null;
  const fallback = { name: "QUT AI & ML Society", members: fallbackMembers, online: null, description: null, icon: null, traits: [], isLive: false };

  try {
    const response = await fetch(`https://discord.com/api/v10/invites/${code}?with_counts=true`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Discord responded ${response.status}`);
    const invite = await response.json();
    const guild = invite.guild ?? {};
    const profile = invite.profile ?? {};
    return {
      name: guild.name ?? fallback.name,
      members: invite.approximate_member_count?.toLocaleString("en-AU") ?? fallback.members,
      online: invite.approximate_presence_count?.toLocaleString("en-AU") ?? null,
      description: guild.description ?? profile.description ?? null,
      icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128` : null,
      traits: (profile.traits ?? []).map(trait => ({ label: trait.label, emoji: EMOJI[trait.emoji_name] ?? "" })),
      isLive: true,
    };
  } catch (error) {
    console.warn(`[discord] Using fallback community details: ${error.message}`);
    return fallback;
  }
}
