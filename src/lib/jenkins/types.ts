export type Comparison = -1 | 0 | 1 | "unknown";
export type JavaVersion = 8 | 11 | 17 | 21 | 25 | null;
export interface InstalledPlugin {
  id: string;
  version: string;
}
export interface Dependency {
  id: string;
  version: string;
  optional: boolean;
}
export interface CatalogPlugin extends InstalledPlugin {
  name: string;
  requiredCore: string;
  dependencies: Dependency[];
  deprecated: boolean;
  deprecationUrl?: string;
  healthScore?: number;
}
export interface AffectedRange {
  firstVersion?: string;
  lastVersion?: string;
  pattern?: string;
}
export interface SecurityWarning {
  id: string;
  pluginId: string | null;
  core: boolean;
  message: string;
  url?: string;
  ranges: AffectedRange[];
}
export interface MetadataSnapshot {
  id: string;
  targetJenkinsVersion: string;
  generatedAt: string;
  sourceGeneratedAt: string | null;
  sourceUrl: string;
  source: "fixture" | "jenkins";
  plugins: Record<string, CatalogPlugin>;
  warnings: SecurityWarning[];
}
export interface ScanInput {
  currentJenkinsVersion: string;
  javaVersion: JavaVersion;
  plugins: InstalledPlugin[];
}
export type Severity = "BLOCKER" | "WARNING" | "INFO";
export type Category =
  "core" | "java" | "security" | "compatibility" | "maintenance" | "dependency";
export interface Finding {
  category: Category;
  severity: Severity;
  code: string;
  message: string;
  pluginId?: string;
  reference?: string;
}
export interface PluginResult {
  id: string;
  installedVersion: string | null;
  offeredVersion: string | null;
  proposedVersion: string | null;
  comparison: Comparison;
  status:
    | "update-offered"
    | "current"
    | "unknown"
    | "missing"
    | "newer-installed"
    | "add";
  requiredCore: string | null;
  dependencies: Dependency[];
  transitive: boolean;
}
export type Complexity = "LOW" | "MEDIUM" | "HIGH" | "VERY HIGH";
export interface UpgradeReport {
  currentJenkinsVersion: string;
  javaVersion: JavaVersion;
  targetJenkinsVersion: string;
  coreComparison: Comparison;
  pluginCount: number;
  snapshot: Pick<
    MetadataSnapshot,
    "id" | "generatedAt" | "sourceGeneratedAt" | "source" | "sourceUrl"
  >;
  java: {
    current: boolean | null;
    target: boolean | null;
    supportedTarget: number[] | null;
    migrationRequired: boolean | null;
  };
  plugins: PluginResult[];
  findings: Finding[];
  complexity: Complexity;
  drivers: string[];
  recommendations: string[];
}
