/**
 * Core type definitions for engrain
 */

export interface Skill {
  name: string;
  description: string;
  path: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SkillIndex {
  root: string;
  skills: SkillEntry[];
  timestamp: string;
}

export interface SkillEntry {
  name: string;
  files: string[];
}

export interface CompressionResult {
  original: Skill;
  compressed: string;
  ratio: number;
  tokenCount: {
    before: number;
    after: number;
  };
}
