import { test as base } from "@playwright/test";
import { mockAllAPIs } from "./api-mocks";

type KameFixtures = {
  /** Página con todas las APIs mockeadas — listo para navegar */
  mockedPage: ReturnType<typeof base.extend> extends { page: infer P } ? P : never;
};

/**
 * Fixture extendido: mockedPage tiene todas las APIs interceptadas antes
 * de que la página se cargue, evitando flakiness por race conditions.
 */
export const test = base.extend<{ mockedPage: Parameters<Parameters<typeof base.extend>[0]["mockedPage"]>[0]["page"] }>({
  mockedPage: async ({ page }, use) => {
    await mockAllAPIs(page);
    await use(page as any);
  },
});

export { expect } from "@playwright/test";
export * from "./api-mocks";
export * from "./catalog-data";
