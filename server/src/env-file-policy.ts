export function shouldLoadWorkingDirectoryEnv(input: {
  cwdEnvExists: boolean;
  isAndrecompEnvFile: boolean;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const env = input.env ?? process.env;
  return env.ANDRECOMP_DISABLE_CWD_ENV_FILE !== "true"
    && input.cwdEnvExists
    && !input.isAndrecompEnvFile;
}
