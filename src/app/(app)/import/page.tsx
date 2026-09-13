import { ComingSoon } from '@/components/ComingSoon';

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Importar extrato</h1>
        <p className="text-sm text-slate-500">Manual, por CSV, ou futuramente via Open Finance.</p>
      </div>
      <ComingSoon
        icon="📥"
        title="Importação chega em breve"
        description="Você vai poder colar ou enviar o extrato do banco e revisar a categoria sugerida antes de confirmar."
      />
    </div>
  );
}
