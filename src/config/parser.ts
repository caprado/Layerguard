/**
 * Flow rule parser
 *
 * Parses flow rule strings like 'A -> B' and 'A <-> B' into structured data
 * and builds a directed graph representing allowed dependency directions.
 */

import type { ParsedFlowRule, FlowGraph } from './types.js'

/**
 * Regex patterns for flow rule parsing
 */
const BIDIRECTIONAL_PATTERN = /^\s*(\S+)\s*<->\s*(\S+)\s*$/
const CHAIN_ARROW = /->/

export class FlowParseError extends Error {
  constructor(
    public readonly rule: string,
    message: string
  ) {
    super(`Invalid flow rule '${rule}': ${message}`)
    this.name = 'FlowParseError'
  }
}

/**
 * Parse a single flow rule string into structured representations
 *
 * Supports both simple rules ('A -> B', 'A <-> B') and chained rules ('A -> B -> C').
 * Chained rules are expanded into multiple pairs.
 *
 * @param rule - Flow rule string (e.g., 'A -> B', 'A <-> B', or 'A -> B -> C')
 * @returns Array of parsed flow rules (chains expand to multiple rules)
 * @throws FlowParseError if the rule string is invalid
 */
export function parseFlowRule(rule: string): ParsedFlowRule[] {
  if (!rule || typeof rule !== 'string') {
    throw new FlowParseError(String(rule), 'Rule must be a non-empty string')
  }

  // Try bidirectional first (only valid for two layers, no chaining)
  const bidirectionalMatch = rule.match(BIDIRECTIONAL_PATTERN)
  if (bidirectionalMatch) {
    const [, from, to] = bidirectionalMatch
    if (!from || !to) {
      throw new FlowParseError(rule, 'Missing layer name')
    }
    return [{ from, to, direction: 'bidirectional' }]
  }

  // Check for mixed operators (e.g., 'A <-> B -> C')
  if (rule.includes('<->') && rule.includes('->')) {
    // If <-> appears alongside ->, it's invalid
    // (The bidirectional match above handles pure <-> cases)
    throw new FlowParseError(rule, "Cannot mix '<->' and '->' in a chain. Use separate rules instead")
  }

  // Check for double arrow (common mistake)
  if (rule.includes('-->')) {
    throw new FlowParseError(rule, "Use '->' for unidirectional flow, not '-->'")
  }

  // Handle unidirectional chains: 'A -> B -> C' expands to [{A->B}, {B->C}]
  if (CHAIN_ARROW.test(rule)) {
    const layers = rule.split('->').map((s) => s.trim())

    // Validate all layer names are non-empty
    for (let i = 0; i < layers.length; i++) {
      if (!layers[i]) {
        throw new FlowParseError(rule, `Empty layer name at position ${i + 1}`)
      }
    }

    // Need at least 2 layers for a valid rule
    if (layers.length < 2) {
      throw new FlowParseError(rule, 'Flow rule requires at least two layers')
    }

    // Build pairs from adjacent layers
    const rules: ParsedFlowRule[] = []
    for (let i = 0; i < layers.length - 1; i++) {
      rules.push({
        from: layers[i]!,
        to: layers[i + 1]!,
        direction: 'unidirectional',
      })
    }
    return rules
  }

  // No match - provide helpful error message
  if (rule.includes('<-') && !rule.includes('<->')) {
    throw new FlowParseError(rule, "Did you mean '<->'? Use '->' for unidirectional or '<->' for bidirectional")
  }
  if (!rule.includes('->') && !rule.includes('<->')) {
    throw new FlowParseError(rule, "Missing arrow operator. Use '->' for unidirectional or '<->' for bidirectional")
  }

  throw new FlowParseError(rule, 'Invalid format. Expected "A -> B", "A <-> B", or "A -> B -> C"')
}

/**
 * Parse multiple flow rule strings
 *
 * @param rules - Array of flow rule strings
 * @returns Array of parsed flow rules (chains are expanded)
 * @throws FlowParseError if any rule is invalid
 */
export function parseFlowRules(rules: string[]): ParsedFlowRule[] {
  return rules.flatMap(parseFlowRule)
}

/**
 * Build a directed graph from parsed flow rules
 *
 * The graph maps each layer to the set of layers it can import FROM.
 * For 'A -> B', A can import from B, so graph.get('A').has('B') is true.
 * For 'A <-> B', both directions are allowed.
 *
 * @param rules - Array of parsed flow rules
 * @returns Directed graph (adjacency list)
 */
export function buildFlowGraph(rules: ParsedFlowRule[]): FlowGraph {
  const graph: FlowGraph = new Map()

  // Helper to ensure a layer exists in the graph
  const ensureLayer = (layer: string): Set<string> => {
    let edges = graph.get(layer)
    if (!edges) {
      edges = new Set()
      graph.set(layer, edges)
    }
    return edges
  }

  for (const rule of rules) {
    // 'from -> to' means 'from' can import from 'to'
    // So we add an edge from 'from' to 'to'
    const fromEdges = ensureLayer(rule.from)
    fromEdges.add(rule.to)

    // Ensure 'to' exists in the graph even if it has no outgoing edges
    ensureLayer(rule.to)

    // For bidirectional, also add the reverse edge
    if (rule.direction === 'bidirectional') {
      const toEdges = ensureLayer(rule.to)
      toEdges.add(rule.from)
    }
  }

  return graph
}

/**
 * Check if a layer can import from another layer according to the flow graph
 *
 * @param graph - The flow graph
 * @param from - The importing layer
 * @param to - The layer being imported
 * @returns true if the import is allowed
 */
export function canImport(graph: FlowGraph, from: string, to: string): boolean {
  const edges = graph.get(from)
  return edges?.has(to) ?? false
}

/**
 * Get all layers that have no flow rules defined (isolated layers)
 *
 * @param graph - The flow graph
 * @returns Array of layer names with no connections
 */
export function findIsolatedLayers(graph: FlowGraph): string[] {
  const isolated: string[] = []

  for (const [layer, edges] of graph) {
    // A layer is isolated if it has no outgoing edges AND no other layer points to it
    const hasOutgoing = edges.size > 0
    let hasIncoming = false

    for (const [, otherEdges] of graph) {
      if (otherEdges.has(layer)) {
        hasIncoming = true
        break
      }
    }

    if (!hasOutgoing && !hasIncoming) {
      isolated.push(layer)
    }
  }

  return isolated
}
