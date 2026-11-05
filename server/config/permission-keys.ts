// Known granular permissions. Unknown/new keys remain denied until explicitly granted.
export const PERMISSION_KEYS: Record<string, string[]> = {
  dashboard: ['verFaturamento', 'verDesempenhoEquipe', 'verMetricasLeads'],
  agendamentos: ['verAgendamentosAlheios', 'criarAgendamentos', 'editarAgendamentos', 'cancelarAgendamentos'],
  clientes: ['verClientes', 'verLeads', 'exportarContatos', 'editarContatos', 'excluirContatos'],
  funnel: ['moverFases', 'criarPropostas', 'aprovarPropostas', 'excluirOportunidades'],
  tarefas: ['atribuirParaOutros', 'verTarefasAlheias', 'excluirTarefas'],
  metas: ['gerenciarMetas', 'verMetasEquipe'],
  campanhas: ['criarCampanhas', 'conectarWhatsApp', 'excluirCampanhas'],
}

export function ownerSubPermissions(module: string) {
  return Object.fromEntries((PERMISSION_KEYS[module] || []).map(key => [key, true]))
}
