import { describe, it, expect } from 'vitest';
import { calculateEmissionValue, findEmissionFactor } from '../src/services/carbon.service.js';
import prisma from '../src/db/db.js';

describe('Carbon Engine - Deterministic Calculations', () => {
  
  describe('calculateEmissionValue', () => {
    
    it('should correctly multiply integers', () => {
      const result = calculateEmissionValue(10, 2, 'kWh', 'kWh');
      expect(result).toBe(20);
    });

    it('should correctly multiply decimals', () => {
      const result = calculateEmissionValue(10.5, 0.7, 'kWh', 'kWh');
      expect(result).toBeCloseTo(7.35);
    });

    it('should handle zero quantity', () => {
      const result = calculateEmissionValue(0, 0.7, 'kWh', 'kWh');
      expect(result).toBe(0);
    });

    it('should throw error on invalid negative values', () => {
      expect(() => calculateEmissionValue(-10, 0.7, 'kWh', 'kWh')).toThrowError('Quantity cannot be negative');
    });

    it('should throw error on unsupported/mismatched units', () => {
      expect(() => calculateEmissionValue(10, 0.7, 'm3', 'kWh')).toThrowError('Incompatible units');
    });

    it('should be deterministic and repeatable', () => {
      const result1 = calculateEmissionValue(123.45, 0.678, 'L', 'L');
      const result2 = calculateEmissionValue(123.45, 0.678, 'L', 'L');
      expect(result1).toBe(result2);
    });
  });

});
