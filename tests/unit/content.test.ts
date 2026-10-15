import { describe, expect, it } from 'vitest';
import { channels, projects, research, verifiedLink } from '../../src/data/content';

describe('T02: verified project content', () => {
  it('lists the projects with only confirmed links and no invented status', () => {
    expect(projects.map((project) => [project.name, project.href])).toEqual([
      ['Sentinel', null],
      ['SkillFetch', 'https://github.com/Arete-Club/SkillFetch'],
      ['Handoff', 'https://github.com/Arete-Club/handoff-skill'],
    ]);
    for (const project of projects) {
      expect(project.summary.length).toBeGreaterThan(10);
      expect(project.status).toBeNull();
      if (project.href) expect(verifiedLink(project.href)).toBe(project.href);
    }
    expect(channels).toEqual({ github: 'https://github.com/Arete-Club', email: null });
  });
  it('keeps the four research interests from the brand PRD', () => {
    expect(research.map((area) => area.title)).toEqual([
      'AI Agents & Orchestration', 'Reliability & Verification', 'Context & Memory', 'Efficient Intelligence',
    ]);
  });
  it.each([null, '', 'javascript:alert(1)', 'https://user:password@example.com', '#', '/unknown', 'http://example.com'])('omits an unsafe or unverified link: %s', (value) => {
    expect(verifiedLink(value)).toBeNull();
  });
  it('accepts a supplied HTTPS project URL', () => {
    expect(verifiedLink('https://github.com/example/project')).toBe('https://github.com/example/project');
  });
});
