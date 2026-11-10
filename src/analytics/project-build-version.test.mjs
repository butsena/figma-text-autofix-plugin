import { it, expect } from "vitest";
import { projectBuildVersion } from "../../scripts/project-build-version.mjs";

it("takes the project version without environment configuration", () => {
  expect(projectBuildVersion({}, {version:"0.23.0"})).toBe("0.23.0");
  expect(projectBuildVersion({})).toMatch(/^\d+\.\d+\.\d+/);
});
it("keeps explicit candidate overrides and never silently repairs invalid versions", () => {
  expect(projectBuildVersion({PLUGIN_VERSION:"0.24.0-qa.1"}, {version:"0.23.0"})).toBe("0.24.0-qa.1");
  for (const version of ["", "smoke", "garbage", "0.23.0\n"]) {
    expect(() => projectBuildVersion({PLUGIN_VERSION:version}, {version:"0.23.0"})).toThrow();
    expect(() => projectBuildVersion({}, {version})).toThrow();
  }
  expect(() => projectBuildVersion({}, {})).toThrow();
});
