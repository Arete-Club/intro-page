export type Project = {
  name: string;
  category: string;
  summary: string;
  /** Korean summary shown when the page is switched to Korean (SPEC K07). Draft — edit freely. */
  summaryKo: string;
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
    summaryKo: '인간의 의도에 부합하고 검증 가능한 AI 엔지니어링 워크플로를 탐구합니다.',
    status: null,
    href: null,
  },
  {
    name: 'SkillFetch',
    category: 'Developer Tooling',
    summary: 'Helping agents discover and use the skills they need for each task.',
    summaryKo: '에이전트가 작업마다 필요한 스킬을 찾아 활용하도록 돕습니다.',
    status: null,
    href: 'https://github.com/Arete-Club/SkillFetch',
  },
  {
    name: 'Handoff',
    category: 'Agent Skill',
    summary: 'Helping AI coding agents continue work across sessions with a concise, verifiable HANDOFF.md.',
    summaryKo: '간결하고 검증 가능한 HANDOFF.md로 AI 코딩 에이전트가 세션을 넘어 작업을 이어가도록 돕습니다.',
    status: null,
    href: 'https://github.com/Arete-Club/handoff-skill',
  },
];

export const channels: OfficialChannels = { github: 'https://github.com/Arete-Club', email: null };

// Titles stay in English in both languages; descriptionKo is the Korean draft (SPEC K06–K07).
export const research = [
  { title: 'AI Agents & Orchestration', description: 'Agent architectures and workflows', descriptionKo: '에이전트 구조와 작업 흐름' },
  { title: 'Reliability & Verification', description: 'Verifiability and reliability', descriptionKo: '검증 가능성과 신뢰성' },
  { title: 'Context & Memory', description: 'Preserving context across long sessions', descriptionKo: '장기 세션에서의 맥락 유지' },
  { title: 'Efficient Intelligence', description: 'Model, inference, and system efficiency', descriptionKo: '모델·추론·시스템 효율화' },
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
