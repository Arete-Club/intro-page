export type Project = {
  name: string;
  category: string;
  summary: string;
  status: string | null;
  href: string | null;
};

export type OfficialChannels = { github: string | null; email: string | null };

// Publish a status or link only after its source has been confirmed.
// SkillFetch / Handoff URLs and the organization were provided by the user and
// confirmed as public on GitHub (2026-10-16). Sentinel's repository is private.
export const projects: Project[] = [
  {
    name: 'Sentinel',
    category: 'AI Agent Research',
    summary: 'Exploring verifiable AI engineering workflows aligned with human intent.',
    status: null,
    href: null,
  },
  {
    name: 'SkillFetch',
    category: 'Developer Tooling',
    summary: 'Helping agents discover and use the skills they need for each task.',
    status: null,
    href: 'https://github.com/Arete-Club/SkillFetch',
  },
  {
    name: 'Handoff',
    category: 'Agent Skill',
    summary: 'Helping AI coding agents continue work across sessions with a concise, verifiable HANDOFF.md.',
    status: null,
    href: 'https://github.com/Arete-Club/handoff-skill',
  },
];

export const channels: OfficialChannels = { github: 'https://github.com/Arete-Club', email: null };

export const research = [
  { title: 'AI Agents & Orchestration', description: 'Agent architectures and workflows' },
  { title: 'Reliability & Verification', description: 'Verifiability and reliability' },
  { title: 'Context & Memory', description: 'Preserving context across long sessions' },
  { title: 'Efficient Intelligence', description: 'Model, inference, and system efficiency' },
];

export function verifiedLink(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
