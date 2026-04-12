export function isWompiSandboxE2EEnabled(): boolean {
  const v = process.env.RUN_WOMPI_SANDBOX_E2E;
  return v === "1" || v?.toLowerCase() === "true" || v?.toLowerCase() === "yes";
}
