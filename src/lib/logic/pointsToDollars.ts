import { POINTS_PER_DOLLAR } from './calculatePoints';

export function pointsToDollars(points: number): number {
  return points / POINTS_PER_DOLLAR;
}

export function dollarsToPoints(dollars: number): number {
  return Math.round(dollars * POINTS_PER_DOLLAR);
}
