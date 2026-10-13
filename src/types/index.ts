import type { ConceptExplanation } from '../services/ai/explainConcept';
export interface Concept {
  id: string;
  name: string;
  category: string;
  description: string;
  properties: string[];
  functions: string[];
  constraints: string[];
  relatedConcepts: string[];
  tags: string[];
  source?: 'manual' | 'local' | 'api';
}
export type ConceptDraft = Omit<Concept, 'id' | 'source'>;
export interface Connection {
  source?: 'local' | 'api';
  dimension?: string;
  basisA?: { status: '已知特征' | '用户定义' | '推测'; reason: string };
  basisB?: { status: '已知特征' | '用户定义' | '推测'; reason: string };
  id: string;
  title: string;
  conceptAProperty: string;
  conceptBProperty: string;
  explanation: string;
  novelty: number | null;
  plausibility: number | null;
}
export type IdeaKind = '实用型' | '探索型' | '荒诞型';
export interface Idea {
  id: string;
  rootId: string;
  parentId: string | null;
  version: number;
  mutation: string;
  collisionId: string;
  connectionId: string;
  kind: IdeaKind;
  name: string;
  summary: string;
  problem: string;
  principle: string;
  contributionA: string;
  contributionB: string;
  implementation: string;
  biggestProblem: string;
  novelty: number | null;
  feasibility: number | null;
  fun: number | null;
  createdAt: string;
  source: 'local' | 'api';
}
export interface Critic {
  majorProblems: string[];
  minorProblems: string[];
  potentialFixes: string[];
  verdict: 'Promising' | 'Needs Work' | 'Mostly Gimmick' | 'Physically Questionable';
  explanation: string;
}
export interface Collision {
  id: string;
  conceptAId: string;
  conceptBId: string;
  connections: Connection[];
  createdAt: string;
  source: 'local' | 'api';
  notice?: string;
}
export interface Settings {
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  authMode?: 'auto' | 'bearer' | 'api-key' | 'x-api-key' | 'none';
  jsonMode?: boolean;
  requestTimeoutSeconds?: number;
}
export interface AppData {
  schemaVersion: 1;
  pair: [string, string];
  customConcepts: Concept[];
  explanations: Record<string, ConceptExplanation>;
  collisions: Collision[];
  ideas: Idea[];
  critics: Record<string, Critic>;
  favorites: { concepts: string[]; collisions: string[]; ideas: string[] };
  settings: Settings;
}
export interface ConnectionOptions {
  count?: number;
  exclude?: Connection[];
  signal?: AbortSignal;
  onNotice?: (notice: string) => void;
}
export interface InnovationProvider {
  analyzeConcept(name: string, description?: string, signal?: AbortSignal): Promise<ConceptDraft>;
  generateConnections(a: Concept, b: Concept, options?: ConnectionOptions): Promise<Connection[]>;
  generateIdeas(
    a: Concept,
    b: Concept,
    c: Connection,
    collisionId: string,
    signal?: AbortSignal,
  ): Promise<Idea[]>;
  evolveIdea(
    idea: Idea,
    mutation: string,
    a: Concept,
    b: Concept,
    signal?: AbortSignal,
  ): Promise<Idea>;
  criticizeIdea(idea: Idea, a: Concept, b: Concept, signal?: AbortSignal): Promise<Critic>;
}
