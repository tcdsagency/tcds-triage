/**
 * EZLynx Reference Data Resolver
 * ================================
 * Caches reference data from the bot and provides lookup methods
 * for mapping form values to EZLynx enum values dynamically.
 */

import { ezlynxBot } from './ezlynx-bot';

interface EnumValue {
  value: number;
  name: string;
  description: string;
}

interface CacheEntry {
  data: EnumValue[];
  loadedAt: number;
}

const TTL_MS = 60 * 60 * 1000; // 1 hour client-side (bot caches 24hr)

class EzLynxReferenceResolver {
  private cache = new Map<string, CacheEntry>();
  private loading = new Map<string, Promise<EnumValue[]>>();

  /**
   * Get all values for a reference data category.
   */
  async getAll(category: string): Promise<EnumValue[]> {
    const cached = this.cache.get(category);
    if (cached && Date.now() - cached.loadedAt < TTL_MS) {
      return cached.data;
    }

    const existing = this.loading.get(category);
    if (existing) return existing;

    const promise = ezlynxBot
      .getReferenceData(category)
      .then((data: any[]) => {
        const items = Array.isArray(data) ? data : [];
        this.cache.set(category, { data: items, loadedAt: Date.now() });
        this.loading.delete(category);
        return items;
      })
      .catch((err) => {
        this.loading.delete(category);
        throw err;
      });

    this.loading.set(category, promise);
    return promise;
  }

  /**
   * Resolve a search term to an EZLynx enum value by fuzzy matching
   * against the name and description fields.
   */
  async resolve(
    category: string,
    searchTerm: string
  ): Promise<EnumValue | null> {
    if (!searchTerm) return null;

    const items = await this.getAll(category);
    const term = searchTerm.toLowerCase().trim();

    // Exact match on name
    const exactName = items.find(
      (i) => i.name?.toLowerCase() === term
    );
    if (exactName) return exactName;

    // Exact match on description
    const exactDesc = items.find(
      (i) => i.description?.toLowerCase() === term
    );
    if (exactDesc) return exactDesc;

    // Partial match on description
    const partialDesc = items.find(
      (i) => i.description?.toLowerCase().includes(term)
    );
    if (partialDesc) return partialDesc;

    // Partial match on name
    const partialName = items.find(
      (i) => i.name?.toLowerCase().includes(term)
    );
    if (partialName) return partialName;

    return null;
  }

  /**
   * Get options formatted for UI dropdowns.
   */
  async getOptions(
    category: string
  ): Promise<{ label: string; value: number }[]> {
    const items = await this.getAll(category);
    return items.map((i) => ({
      label: i.description || i.name,
      value: i.value,
    }));
  }

  /**
   * Preload multiple categories in parallel.
   */
  async preload(categories: string[]): Promise<void> {
    await Promise.allSettled(categories.map((c) => this.getAll(c)));
  }

  /**
   * Clear all cached data.
   */
  clear(): void {
    this.cache.clear();
  }
}

// Singleton
export const ezlynxReference = new EzLynxReferenceResolver();
