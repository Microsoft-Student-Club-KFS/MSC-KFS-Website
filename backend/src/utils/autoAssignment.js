/**
 * Microsoft Campus Club - KFS
 * Auto-Assignment Algorithm for Member Placement
 * File: backend/src/utils/autoAssignment.js
 */

/**
 * Selects the best group for auto-assignment based on capacity and current member count.
 * 
 * Rules:
 * 1. Filter out groups that are full (activeCount >= capacity, if capacity is set).
 * 2. If no groups have available capacity, return null (handled as a 409 conflict).
 * 3. Prioritize groups with finite capacity over groups with infinite capacity (null capacity),
 *    treating infinite capacity groups as a last resort.
 * 4. Among finite groups, choose the one with the most remaining capacity (capacity - activeCount).
 * 5. Among infinite groups, choose the one with the fewest active members (activeCount).
 * 6. In case of ties, break them by group code lexicographically ascending.
 * 
 * @param {Array<{id: string, code: string, capacity: number|null, activeCount: number}>} groups
 * @returns {string|null} The chosen group ID, or null if no group is eligible.
 */
function chooseGroupForAssignment(groups) {
  // 1. Filter to eligible groups (capacity is null or activeCount < capacity)
  const eligible = groups.filter(g => g.capacity === null || g.activeCount < g.capacity);
  
  if (eligible.length === 0) {
    return null;
  }

  // 2. Sort groups according to priority rules
  eligible.sort((a, b) => {
    const aIsFinite = a.capacity !== null;
    const bIsFinite = b.capacity !== null;

    // Prioritize finite capacity over infinite capacity
    if (aIsFinite && !bIsFinite) {
      return -1; // a has finite capacity, so it goes first
    }
    if (!aIsFinite && bIsFinite) {
      return 1;  // b has finite capacity, so it goes first
    }

    if (aIsFinite && bIsFinite) {
      // Both are finite capacity: sort by remaining capacity descending
      const aRemaining = a.capacity - a.activeCount;
      const bRemaining = b.capacity - b.activeCount;
      if (aRemaining !== bRemaining) {
        return bRemaining - aRemaining;
      }
    } else {
      // Both are infinite capacity: sort by activeCount ascending to distribute evenly
      if (a.activeCount !== b.activeCount) {
        return a.activeCount - b.activeCount;
      }
    }

    // Tie-breaker: sort by group code ascending for determinism
    return a.code.localeCompare(b.code);
  });

  // Return the best eligible group's ID
  return eligible[0].id;
}

module.exports = {
  chooseGroupForAssignment
};
