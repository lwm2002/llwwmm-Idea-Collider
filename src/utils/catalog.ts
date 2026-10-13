import { concepts as builtins } from '../data/concepts';
import type { Concept, ConceptDraft } from '../types';
import { uid } from './id';

export const normalizeName = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ');
export const nameKey = (name: string) => normalizeName(name).toLocaleLowerCase();
export function matchesConcept(concept: Concept, query: string): boolean {
  const key = nameKey(query);
  return [
    concept.name,
    concept.category,
    concept.description,
    ...concept.tags,
    ...concept.properties,
  ].some((field) => nameKey(field).includes(key));
}
export function createCatalog(customConcepts: Concept[]) {
  const concepts = [...builtins, ...customConcepts];
  const conceptMap: Record<string, Concept> = Object.assign(
    Object.create(null),
    Object.fromEntries(concepts.map((c) => [c.id, c])),
  );
  return { concepts, conceptMap };
}
export function findConceptByName(catalog: Concept[], name: string): Concept | undefined {
  return catalog.find((c) => nameKey(c.name) === nameKey(name));
}
export function materializeConcept(
  draft: ConceptDraft,
  catalog: Concept[],
  source: NonNullable<Concept['source']>,
): Concept {
  const related = draft.relatedConcepts
    .map((value) => catalog.find((c) => c.id === value || nameKey(c.name) === nameKey(value))?.id)
    .filter((id): id is string => !!id);
  const nearby = catalog
    .map((c) => ({
      id: c.id,
      score:
        c.tags.filter((t) => draft.tags.includes(t)).length + Number(c.category === draft.category),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((c) => c.id);
  return {
    ...draft,
    id: `custom:${uid()}`,
    name: normalizeName(draft.name),
    relatedConcepts: [...new Set([...related, ...nearby])].slice(0, 6),
    source,
  };
}
