type OperationalRole = { value?: string; isSDR?: boolean; isCloser?: boolean };

// Commercial functions have a small, explicit baseline. Module/plan access is
// checked separately; saved false values and all other modules remain intact.
export function commercialRoleDefaults(role?: OperationalRole | null): Record<string, boolean> {
  if (!role || !(role.isSDR || role.isCloser || role.value === 'comercial')) return {};
  return {
    moverFases: true,
    criarPropostas: true,
    ...(role.isCloser || role.value === 'comercial' ? { aprovarPropostas: true } : {}),
  };
}

export function resolveRoleSubPermissions(role: OperationalRole | null | undefined, moduleCode: string, stored: unknown) {
  const explicit = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored as Record<string, boolean> : {};
  return { ...(moduleCode === 'funnel' ? commercialRoleDefaults(role) : {}), ...explicit };
}
