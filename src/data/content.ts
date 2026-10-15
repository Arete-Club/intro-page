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
    summary: '인간의 의도에 부합하고 검증 가능한 AI 엔지니어링 워크플로를 탐구합니다.',
    status: null,
    href: null,
  },
  {
    name: 'SkillFetch',
    category: 'Developer Tooling',
    summary: '에이전트가 작업에 필요한 스킬을 탐색하고 활용하도록 돕습니다.',
    status: null,
    href: 'https://github.com/Arete-Club/SkillFetch',
  },
  {
    name: 'Handoff',
    category: 'Agent Skill',
    summary: 'AI 코딩 에이전트가 짧고 검증 가능한 HANDOFF.md로 세션 사이의 작업을 이어가도록 돕습니다.',
    status: null,
    href: 'https://github.com/Arete-Club/handoff-skill',
  },
];

export const channels: OfficialChannels = { github: 'https://github.com/Arete-Club', email: null };

export const research = [
  { title: 'AI Agents & Orchestration', description: '에이전트 구조와 작업 흐름' },
  { title: 'Reliability & Verification', description: '검증 가능성과 신뢰성' },
  { title: 'Context & Memory', description: '장기 세션에서의 맥락 유지' },
  { title: 'Efficient Intelligence', description: '모델·추론·시스템 효율화' },
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
