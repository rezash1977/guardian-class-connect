import { useState, useMemo } from 'react';

// Define the sort direction type
type SortDirection = 'ascending' | 'descending';

// Define the structure for the sort configuration
interface SortConfig {
  key: string; // Changed to string to allow dot notation for nested properties
  direction: SortDirection;
}

/**
 * A helper function to safely access nested property values, including the first element of an array in the path.
 * @param obj The object to access.
 * @param path The dot-notation path to the property (e.g., 'class_subjects.subjects.name').
 * @returns The nested value or null if not found.
 */
const getNestedValue = (obj: any, path: string): any => {
  let current = obj;
  for (const part of path.split('.')) {
    if (current === null || current === undefined) {
      return null;
    }
    // If the current level is an array, we proceed with the first element.
    if (Array.isArray(current)) {
      current = current.length > 0 ? current[0] : null;
      if (current === null || current === undefined) {
        return null;
      }
    }
    current = current[part];
  }
  return current;
};

/**
 * A custom hook to sort an array of objects, with support for nested properties.
 * @param items The array of items to sort.
 * @param initialConfig The initial sort configuration.
 * @returns An object with sorted items, a function to request sorting, and the current sort configuration.
 */
export const useSortableData = <T extends object>(
  items: T[],
  initialConfig: SortConfig | null = null
) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(initialConfig);

  const sortedItems = useMemo(() => {
    // Return an empty array if items is not available
    if (!items) return [];
    
    // Create a mutable copy of the items
    let sortableItems = [...items];
    
    // Sort the items if a configuration is set
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = getNestedValue(a, sortConfig.key);
        const bValue = getNestedValue(b, sortConfig.key);

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        // LocaleCompare for string comparison to handle Persian characters correctly
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortConfig.direction === 'ascending' 
                ? aValue.localeCompare(bValue, 'fa') 
                : bValue.localeCompare(aValue, 'fa');
        }

        // Standard comparison for numbers and other types
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  /**
   * Toggles the sort direction or sets a new sort key.
   * @param key The key of the object to sort by (can use dot notation).
   */
  const requestSort = (key: string) => {
    let direction: SortDirection = 'ascending';
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'ascending'
    ) {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  return { items: sortedItems, requestSort, sortConfig };
};

