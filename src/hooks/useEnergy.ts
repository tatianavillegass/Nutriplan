import { useMemo } from 'react';
import type { Client } from '../types/client';
import { calcBmr, pickBmr } from '../utils/bmr';
import { calcEnergy } from '../utils/energy';
import { getActivityFactor, THERMOGENESIS_FACTOR } from '../data/activityFactors';

export function useEnergy(client: Client | undefined) {
  return useMemo(() => {
    if (!client) return null;
    const bmr = calcBmr({
      sexo: client.sexo,
      peso: client.peso,
      altura: client.altura,
      edad: client.edad,
    });
    const tmb = pickBmr(bmr, client.bmrFormula);
    const activityFactor = getActivityFactor(client.activityFactorId);
    const energy = calcEnergy({
      tmb,
      activityFactor,
      thermogenesis: THERMOGENESIS_FACTOR,
      goalMultiplier: client.goalMultiplier,
    });
    return { bmr, energy, activityFactor };
  }, [client]);
}
