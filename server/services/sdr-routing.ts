type RoutingDatabase = {
  empresa: { findUnique(args: any): Promise<{ leadRoutingMode: string | null } | null> }
  usuario: { findMany(args: any): Promise<Array<{ id: number; leadRoutingWeight: number | null }>> }
}

// Keep WhatsApp leads on the same SDR distribution used by leads created in the app.
export async function chooseSdrForCompany(db: RoutingDatabase, companyId: number): Promise<number | null> {
  const company = await db.empresa.findUnique({ where: { id: companyId }, select: { leadRoutingMode: true } })
  if (!company || company.leadRoutingMode === 'manual') return null
  const sdrs = await db.usuario.findMany({
    where: { companyId, isActive: true, role: { isSDR: true } },
    select: { id: true, leadRoutingWeight: true },
  })
  if (!sdrs.length) return null
  if (company.leadRoutingMode === 'automatic_equal') {
    return sdrs[Math.floor(Math.random() * sdrs.length)].id
  }
  if (company.leadRoutingMode === 'semi_automatic') {
    const weights = sdrs.map((sdr) => sdr.leadRoutingWeight || 1)
    let random = Math.random() * weights.reduce((sum, weight) => sum + weight, 0)
    for (let index = 0; index < sdrs.length; index++) {
      random -= weights[index]
      if (random <= 0) return sdrs[index].id
    }
    return sdrs[sdrs.length - 1].id
  }
  return null
}
