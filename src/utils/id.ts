export const uid = () => crypto.randomUUID();
export const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
export const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
