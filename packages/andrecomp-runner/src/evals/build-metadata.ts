import { createHash } from "node:crypto";

import { ANDRECOMP_RUNNER_COMPATIBILITY } from "../compatibility.js";
import {
  PRP_PROTOCOL_MIN_VERSION,
  PRP_PROTOCOL_NAME,
  PRP_PROTOCOL_VERSION,
} from "../protocol/replay-contract.js";
import { canonicalCapabilitySemanticCatalog } from "../semantic-tools/catalog.js";

export const ANDRECOMP_RUNNER_BUILD_METADATA_SCHEMA =
  "andrecomp-runner/build-metadata/v1" as const;
export const ANDRECOMP_RUNNER_NATIVE_EXECUTION_SCHEMA =
  "andrecomp-runner/native-execution/v1" as const;
export const ANDRECOMP_RUNNER_EVAL_INTEGRATION_SCHEMA =
  "andrecomp-runner/evals-integration/v1" as const;
export const ANDRECOMP_RUNNERD_BUILD_METADATA_SCHEMA =
  "andrecomp-runner/runnerd-build-metadata/v1" as const;

export const ANDRECOMP_RUNNER_SEMANTIC_CATALOG_SHA256 =
  `sha256:${createHash("sha256")
    .update(canonicalCapabilitySemanticCatalog())
    .digest("hex")}` as const;

/**
 * App-owned release metadata that Evals pins beside every native attempt.
 * Contract versions are independent from package semver so consumers can give
 * a precise mismatch instead of guessing from a package version.
 */
export const ANDRECOMP_RUNNER_BUILD_METADATA = Object.freeze({
  schema: ANDRECOMP_RUNNER_BUILD_METADATA_SCHEMA,
  package: Object.freeze({
    name: ANDRECOMP_RUNNER_COMPATIBILITY.packageName,
    version: ANDRECOMP_RUNNER_COMPATIBILITY.packageVersion,
  }),
  contracts: Object.freeze({
    evalIntegration: ANDRECOMP_RUNNER_COMPATIBILITY.components.evalIntegration,
    nativeExecution: ANDRECOMP_RUNNER_COMPATIBILITY.components.nativeExecution,
    runnerdArtifact: ANDRECOMP_RUNNER_COMPATIBILITY.components.runnerdBinary,
    prp: PRP_PROTOCOL_VERSION,
    semanticCatalog: ANDRECOMP_RUNNER_COMPATIBILITY.components.catalog,
    harnessDriver: ANDRECOMP_RUNNER_COMPATIBILITY.components.harnessDriver,
    controlPlaneAdapter: ANDRECOMP_RUNNER_COMPATIBILITY.components.controlPlaneAdapter,
    testkit: ANDRECOMP_RUNNER_COMPATIBILITY.components.testkit,
  }),
  prp: Object.freeze({
    name: PRP_PROTOCOL_NAME,
    minimumVersion: PRP_PROTOCOL_MIN_VERSION,
    maximumVersion: PRP_PROTOCOL_VERSION,
  }),
  semanticCatalog: Object.freeze({
    version: ANDRECOMP_RUNNER_COMPATIBILITY.components.catalog,
    sha256: ANDRECOMP_RUNNER_SEMANTIC_CATALOG_SHA256,
  }),
  runnerd: Object.freeze({
    binaryName: "andrecomp-runnerd" as const,
    metadataSchema: ANDRECOMP_RUNNERD_BUILD_METADATA_SCHEMA,
    digestAlgorithm: "sha256" as const,
  }),
});

export type AndrecompRunnerBuildMetadata = typeof ANDRECOMP_RUNNER_BUILD_METADATA;
