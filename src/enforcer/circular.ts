/**
 * Circular dependency detection using Tarjan's algorithm
 *
 * Finds strongly connected components (SCCs) in the dependency graph.
 * Any SCC with more than one node represents a circular dependency.
 */

import type { DependencyGraph } from '../parser/graph.js'
import { createCircularViolation, type CircularViolation, type ViolationSeverity } from './violations.js'

/**
 * A strongly connected component (potential cycle)
 */
export interface StronglyConnectedComponent {
  /**
   * Files in this component
   */
  files: string[]

  /**
   * Whether this is a true cycle (more than one node, or self-reference)
   */
  isCycle: boolean
}

/**
 * Result of circular dependency detection
 */
export interface CircularDetectionResult {
  /**
   * All strongly connected components
   */
  components: StronglyConnectedComponent[]

  /**
   * Only the cycles (SCCs with more than one node or self-references)
   */
  cycles: StronglyConnectedComponent[]

  /**
   * Violations for each cycle
   */
  violations: CircularViolation[]
}

/**
 * Tarjan's algorithm state for a single node
 */
interface TarjanNode {
  index: number
  lowlink: number
  onStack: boolean
}

/**
 * Detect circular dependencies in a dependency graph using Tarjan's algorithm
 *
 * @param graph - The dependency graph to analyze
 * @param severity - Severity level for violations
 * @returns Detection result with cycles and violations
 */
export function detectCircularDependencies(
  graph: DependencyGraph,
  severity: ViolationSeverity = 'error'
): CircularDetectionResult {
  const components: StronglyConnectedComponent[] = []
  const nodeState = new Map<string, TarjanNode>()
  const stack: string[] = []
  let index = 0

  /**
   * Tarjan's strongconnect function
   */
  function strongconnect(node: string): void {
    // Set the depth index for node
    const state: TarjanNode = {
      index: index,
      lowlink: index,
      onStack: true,
    }
    nodeState.set(node, state)
    index++
    stack.push(node)

    // Consider successors of node
    const successors = graph.adjacencyList.get(node) ?? new Set()

    for (const successor of successors) {
      const successorState = nodeState.get(successor)

      if (!successorState) {
        // Successor has not yet been visited; recurse on it
        strongconnect(successor)
        const updatedSuccessorState = nodeState.get(successor)!
        state.lowlink = Math.min(state.lowlink, updatedSuccessorState.lowlink)
      } else if (successorState.onStack) {
        // Successor is in stack and hence in the current SCC
        state.lowlink = Math.min(state.lowlink, successorState.index)
      }
    }

    // If node is a root node, pop the stack and generate an SCC
    if (state.lowlink === state.index) {
      const component: string[] = []
      let w: string | undefined

      do {
        w = stack.pop()
        if (w !== undefined) {
          const wState = nodeState.get(w)
          if (wState) {
            wState.onStack = false
          }
          component.push(w)
        }
      } while (w !== node)

      // Reverse to get correct order
      component.reverse()

      // Check if this is a cycle
      const isCycle = component.length > 1 || hasSelfReference(graph, component[0]!)

      components.push({
        files: component,
        isCycle,
      })
    }
  }

  // Run Tarjan's algorithm on all nodes
  for (const file of graph.files) {
    if (!nodeState.has(file)) {
      strongconnect(file)
    }
  }

  // Filter to just cycles
  const cycles = components.filter((c) => c.isCycle)

  // Create violations for each cycle
  const violations = cycles.map((cycle) =>
    createCircularViolation({
      cyclePath: [...cycle.files, cycle.files[0]!], // Add first element to close the loop
      severity,
    })
  )

  return {
    components,
    cycles,
    violations,
  }
}

/**
 * Check if a node has a self-reference (imports itself)
 */
function hasSelfReference(graph: DependencyGraph, node: string): boolean {
  const edges = graph.adjacencyList.get(node)
  return edges?.has(node) ?? false
}

/**
 * Find the actual cycle path for better error messages
 *
 * Given an SCC, finds a specific cycle path through it.
 * This is more useful for error messages than just listing all nodes.
 */
export function findCyclePath(graph: DependencyGraph, scc: string[]): string[] {
  if (scc.length === 0) return []
  if (scc.length === 1) {
    // Self-reference
    return [scc[0]!, scc[0]!]
  }

  const sccSet = new Set(scc)
  const visited = new Set<string>()
  const path: string[] = []

  function dfs(node: string, target: string): boolean {
    if (visited.has(node)) {
      if (node === target && path.length > 0) {
        return true
      }
      return false
    }

    visited.add(node)
    path.push(node)

    const successors = graph.adjacencyList.get(node) ?? new Set()
    for (const successor of successors) {
      if (!sccSet.has(successor)) continue

      if (successor === target && path.length > 1) {
        path.push(successor)
        return true
      }

      if (dfs(successor, target)) {
        return true
      }
    }

    path.pop()
    visited.delete(node)
    return false
  }

  // Start from first node and try to find a cycle back to it
  const start = scc[0]!
  dfs(start, start)

  return path.length > 0 ? path : scc
}

/**
 * Simple cycle detection (less detailed, faster for large graphs)
 *
 * Returns true if any cycle exists, false otherwise.
 */
export function hasAnyCycle(graph: DependencyGraph): boolean {
  const WHITE = 0 // Not visited
  const GRAY = 1 // Being processed (in current path)
  const BLACK = 2 // Fully processed

  const color = new Map<string, number>()

  function hasCycleFrom(node: string): boolean {
    color.set(node, GRAY)

    const successors = graph.adjacencyList.get(node) ?? new Set()
    for (const successor of successors) {
      const successorColor = color.get(successor) ?? WHITE

      if (successorColor === GRAY) {
        // Found a back edge - cycle detected
        return true
      }

      if (successorColor === WHITE && hasCycleFrom(successor)) {
        return true
      }
    }

    color.set(node, BLACK)
    return false
  }

  for (const file of graph.files) {
    if ((color.get(file) ?? WHITE) === WHITE) {
      if (hasCycleFrom(file)) {
        return true
      }
    }
  }

  return false
}
