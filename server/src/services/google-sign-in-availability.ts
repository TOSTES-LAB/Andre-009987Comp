import { isCloudManagedInstance } from "./cloud-instance.js";

export function andrecompGoogleSignInAvailable(): boolean {
  return isCloudManagedInstance();
}
