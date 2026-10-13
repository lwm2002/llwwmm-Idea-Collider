import { afterEach, describe, expect, it, vi } from 'vitest';
import { conceptMap } from '../data/concepts';
import { localGenerator } from './ai/localGenerator';
import { initialData, parseImport, readData, STORAGE_KEY } from './storage';

afterEach(() => vi.unstubAllGlobals());

describe('连接记录完整性', () => {
  it('拒绝同一碰撞内重复的连接 ID，但允许不同碰撞复用连接 ID', async () => {
    const data = initialData();
    const connections = await localGenerator.generateConnections(
      conceptMap['蜂群'],
      conceptMap['金刚石'],
    );
    const collision = {
      id: 'collision',
      conceptAId: '蜂群',
      conceptBId: '金刚石',
      connections,
      createdAt: new Date().toISOString(),
      source: 'local' as const,
    };
    data.collisions = [collision, { ...collision, id: 'other-collision' }];
    expect(parseImport(JSON.stringify(data)).collisions).toHaveLength(2);
    data.collisions = [
      {
        ...collision,
        connections: [connections[0], { ...connections[1], id: connections[0].id }],
      },
    ];
    const raw = JSON.stringify(data);
    expect(() => parseImport(raw)).toThrow('连接 ID 重复');
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (key === STORAGE_KEY ? raw : null),
      setItem,
    });
    expect(readData().warning).not.toBe('');
    expect(setItem).not.toHaveBeenCalled();
  });
});
