import { GraphElements, resolveTargetNodeId } from './graph-explorer.model';

const ELEMENTS: GraphElements = {
  nodes: [
    { data: { id: '1', label: 'entry' } },
    { data: { id: '7', label: 'run(): void' } },
    { data: { id: 'ast-3', label: 'run(): void' } },
    { data: { id: 'ast-4', label: 'compute(int, int): long' } },
  ],
  edges: [],
};

describe('resolveTargetNodeId', () => {
  it('prefers the backend id a CFG or DFG reference carries', () => {
    // '7' is also a plausible label; the id is the stronger claim.
    expect(resolveTargetNodeId(ELEMENTS, '7')).toBe('7');
  });

  it('falls back to an exact label, as an AST reference has no id to give', () => {
    expect(resolveTargetNodeId(ELEMENTS, 'compute(int, int): long')).toBe('ast-4');
  });

  it('falls back to a label prefix when the return type was left out', () => {
    expect(resolveTargetNodeId(ELEMENTS, 'compute(int, int)')).toBe('ast-4');
  });

  it('returns null when nothing matches, so the graph still opens unfocused', () => {
    expect(resolveTargetNodeId(ELEMENTS, 'missing()')).toBeNull();
    expect(resolveTargetNodeId(ELEMENTS, '  ')).toBeNull();
    expect(resolveTargetNodeId(ELEMENTS, null)).toBeNull();
  });
});
