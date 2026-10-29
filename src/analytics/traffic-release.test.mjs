import { it, expect } from 'vitest';
import { assertReleaseMetadata, assertRolloutReady } from '../../scripts/check-analytics-release.mjs';
import { classifyTraffic, migrateTrafficFormula } from '../../scripts/t151-traffic-report.mjs';

it('rejects a QA file renamed or copied into a release folder, a dirty build, and an outdated commit', () => {
  const info = {kind:'release',enabled:true,trafficMode:'production',pluginVersion:'0.23.0',dirty:false,sourceCommit:'commit'};
  expect(() => assertReleaseMetadata(info,'0.23.0','commit')).not.toThrow();
  for (const extra of [{kind:'qa'},{trafficMode:'test'},{dirty:true},{sourceCommit:'other'}]) expect(() => assertReleaseMetadata({...info,...extra},'0.23.0','commit')).toThrow();
  expect(() => assertReleaseMetadata(info,'0.24.0','commit')).toThrow();
});
it('requires both deployed receiver capability and working report verification', () => {
  const health = {collector_revision:'T-151-1',traffic_mode_storage:'events!H',traffic_modes:['production','test']};
  const report = {spreadsheetId:'1hp5YccbllfFn0cYRkvp6ClWEXbx5Es1R79FFLsqfHqM',revision:'T-151-1',testsExcluded:true,formulaErrors:0,verifiedAt:'2026-10-29T12:00:00Z'};
  expect(() => assertRolloutReady(health,report)).not.toThrow();
  expect(() => assertRolloutReady({...health,traffic_modes:undefined},report)).toThrow();
  for(const extra of [{spreadsheetId:'preview-copy'},{formulaErrors:1},{testsExcluded:false}]) expect(() => assertRolloutReady(health,{...report,...extra})).toThrow();
});
it.each([
 ['0.23.0','production','production'],['0.23.0','test','test'],['0.23.0-qa',undefined,'unknown'],
 ['0.18.0','unknown','unknown'],['smoke',undefined,'test'],['smoke','production','invalid'],['0.23.0','bad','invalid'],
])('classifies %s / %s as %s', (version,mode,expected) => expect(classifyTraffic(version,mode)).toBe(expected));
it('adds the work filter to the previously unfiltered coverage date and chart calendar', () => {
  expect(migrateTrafficFormula('=FILTER(events!A$2:A;events!F$2:F="spellcheck_requested")','Методика',34,1)).toContain('events!H$2:H');
  expect(migrateTrafficFormula('=FILTER(events!A2:A;events!A2:A<>"")','Графики',122,0)).toContain('IFERROR');
  expect(() => migrateTrafficFormula('=COUNTA(events!A:A)','unreviewed',1,1)).toThrow();
});
