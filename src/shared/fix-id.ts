export function makeFixId(nodeId: string, ruleId: string, from: number, to: number): string {
  return `${nodeId}:${ruleId}:${from}:${to}`;
}
