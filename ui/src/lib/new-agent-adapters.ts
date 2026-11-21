import { ANDRECOMP_RUNNER_ACPX_PROFILES } from "@andrecomp/adapter-utils";
import { unrestrictedCloudHarnessPolicy, type CloudHarnessPolicy } from "./cloud-harness-policy";

/** Creation policy shared by the picker and direct setup links. */
export function isNewAgentAdapterAllowed(
  type: string,
  {
    cloud,
    harnessPolicy = unrestrictedCloudHarnessPolicy,
    nativeRunnerEnabled,
    openAiDotEnabled = false,
    museEnabled = false,
    runnerProvider,
    candidateHarnesses,
  }: { cloud: boolean; harnessPolicy?: CloudHarnessPolicy; nativeRunnerEnabled: boolean; openAiDotEnabled?: boolean; museEnabled?: boolean; runnerProvider?: string;
    candidateHarnesses?: readonly { agent: "antigravity"; model: string }[] },
) {
  if (cloud && !(type === "andrecomp_runner"
    ? harnessPolicy.isCloudRunnerProviderAllowed(runnerProvider ?? "codex")
    : harnessPolicy.isCloudHarnessAllowed(type))) return false;
  if (type === "openai_dot" || (type === "andrecomp_runner" && runnerProvider === "openai_dot")) {
    return openAiDotEnabled;
  }
  if (type === "muse" || (type === "andrecomp_runner" && runnerProvider === "muse")) return museEnabled && nativeRunnerEnabled;
  if (type === "andrecomp_runner" && runnerProvider === "antigravity") return ANDRECOMP_RUNNER_ACPX_PROFILES.some(profile => profile.value === "antigravity" && profile.qualified)
    || Boolean(candidateHarnesses?.some(candidate => candidate.agent === "antigravity" && candidate.model));
  if (type === "andrecomp_runner") return runnerProvider === "copilot" || nativeRunnerEnabled;
  return true;
}
