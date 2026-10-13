import type { InnovationProvider, Settings } from '../../types';
import { localGenerator } from './localGenerator';
import { openaiCompatible } from './openaiCompatible';
export function getProvider(settings: Settings, offline = false): InnovationProvider {
  return settings.enabled && !offline ? openaiCompatible(settings) : localGenerator;
}
