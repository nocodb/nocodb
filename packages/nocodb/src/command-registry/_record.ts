// CE no-op stub. EE overrides this with the real implementation that
// writes to nc_sandbox_changelog. CE has no sandbox concept, so the
// decorator's call here resolves to this stub and does nothing.
export async function recordCommand(..._args: unknown[]): Promise<void> {
  // intentional no-op
}
