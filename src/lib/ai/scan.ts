import 'server-only';
import type { MaterialId } from '@/lib/types/material';

export interface ScannedItem {
  label: string;
  materialId: MaterialId;
  quantity: number;
  estimatedDollars: number;
  estimatedPoints: number;
}

export interface ScanResult {
  items: ScannedItem[];
  totalDollars: number;
  totalPoints: number;
  mocked: boolean;
}

const MOCK_RESULT: ScanResult = {
  items: [
    {
      label: '4× aluminum cans',
      materialId: 'aluminum',
      quantity: 4,
      estimatedDollars: 0.08,
      estimatedPoints: 800,
    },
    {
      label: '2× PET bottles',
      materialId: 'pet',
      quantity: 2,
      estimatedDollars: 0.05,
      estimatedPoints: 500,
    },
    {
      label: 'Flattened cardboard',
      materialId: 'cardboard',
      quantity: 1,
      estimatedDollars: 0.1,
      estimatedPoints: 1000,
    },
  ],
  totalDollars: 0.23,
  totalPoints: 2300,
  mocked: true,
};

export async function scanImage(imageBase64: string): Promise<ScanResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return MOCK_RESULT;

  // TODO(phase-3-real-ai): swap this in once the @google/genai dep is installed.
  // Keeping mock until the key is provided and the SDK is pinned.
  void imageBase64;
  return MOCK_RESULT;
}
