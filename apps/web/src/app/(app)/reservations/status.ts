export const RES_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Por confirmar', cls: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Confirmada', cls: 'bg-emerald-100 text-emerald-700' },
  completed: { label: 'Completada', cls: 'bg-primary/10 text-primary' },
  cancelled: { label: 'Cancelada', cls: 'bg-destructive/10 text-destructive' },
};
