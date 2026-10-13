import { createRoot, type Root } from "react-dom/client";

export interface AndrecompReactRootHost {
  __andrecompReactRoot?: Root;
}

type CreateRoot = (container: Parameters<typeof createRoot>[0]) => Root;

/**
 * Keep one React root per browser window even if Vite evaluates the entry
 * module more than once during a development reload.
 */
export function getOrCreateAndrecompReactRoot(
  host: object,
  container: Parameters<typeof createRoot>[0],
  create: CreateRoot = createRoot,
): Root {
  const rootHost = host as AndrecompReactRootHost;
  if (rootHost.__andrecompReactRoot) return rootHost.__andrecompReactRoot;

  const root = create(container);
  rootHost.__andrecompReactRoot = root;
  return root;
}
