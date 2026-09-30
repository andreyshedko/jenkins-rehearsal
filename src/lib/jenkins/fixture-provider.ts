import fixture from "../../../tests/fixtures/update-center.json";
import { normalize } from "./update-center-provider";
import type { MetadataProvider } from "./metadata-provider";
export class FixtureProvider implements MetadataProvider {
  async fetchSnapshot() {
    return normalize(
      fixture,
      "2.555.1",
      "https://updates.jenkins.io/update-center.json?version=2.555.1",
      "fixture",
    );
  }
}
