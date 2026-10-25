import { getAdminDb } from '@/lib/firebase/admin';
import type { CategoryGroupDoc, TransactionType } from '@/types/firestore';

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type GroupSeed = { name: string; kind: TransactionType; sortOrder: number; categories: string[] };

// Exactly the groups/categories the product spec calls for — deliberately
// not padded out further ("não criar dezenas de categorias desnecessárias").
const GROUPS: GroupSeed[] = [
  {
    name: 'Moradia & Habitação',
    kind: 'EXPENSE',
    sortOrder: 1,
    categories: [
      'Financiamento imobiliário',
      'Aluguel',
      'Condomínio',
      'IPTU',
      'Energia elétrica',
      'Água',
      'Gás',
      'Internet',
      'Manutenção/reparos residenciais',
    ],
  },
  {
    name: 'Educação dos filhos',
    kind: 'EXPENSE',
    sortOrder: 2,
    categories: [
      'Mensalidade escolar',
      'Cursos extracurriculares',
      'Idiomas',
      'Esportes',
      'Material escolar',
      'Uniformes',
      'Transporte escolar',
      'Matrícula/rematrícula',
    ],
  },
  {
    name: 'Alimentação & Mercado',
    kind: 'EXPENSE',
    sortOrder: 3,
    categories: ['Supermercado', 'Feira', 'Açougue', 'Higiene', 'Limpeza da casa'],
  },
  {
    name: 'Saúde & Seguros',
    kind: 'EXPENSE',
    sortOrder: 4,
    categories: ['Plano de saúde', 'Consultas', 'Exames', 'Farmácia', 'Seguro de vida', 'Seguro residencial'],
  },
  {
    name: 'Transporte & Veículos',
    kind: 'EXPENSE',
    sortOrder: 5,
    categories: ['Financiamento', 'Combustível', 'Seguro auto', 'IPVA', 'Licenciamento', 'Manutenção', 'Estacionamento', 'Pedágios'],
  },
  {
    name: 'Estilo de vida, Lazer & Vestuário',
    kind: 'EXPENSE',
    sortOrder: 6,
    categories: ['Passeios', 'Restaurantes', 'Delivery', 'Viagens', 'Streaming', 'Vestuário', 'Calçados'],
  },
  {
    name: 'Despesas pessoais dos cônjuges',
    kind: 'EXPENSE',
    sortOrder: 7,
    categories: ['Cônjuge 1', 'Cônjuge 2'],
  },
  {
    name: 'Renda principal',
    kind: 'INCOME',
    sortOrder: 1,
    categories: ['Salário CLT', 'Pró-labore', 'Faturamento recorrente PJ'],
  },
  {
    name: 'Renda variável / extra',
    kind: 'INCOME',
    sortOrder: 2,
    categories: ['Comissão', 'Hora extra', 'PLR', 'Bonificação', 'Consultoria avulsa'],
  },
  {
    name: 'Renda passiva / patrimonial',
    kind: 'INCOME',
    sortOrder: 3,
    categories: ['Aluguel recebido', 'Dividendos', 'Juros sobre capital próprio', 'Rendimentos de aplicações'],
  },
  {
    name: 'Benefícios corporativos',
    kind: 'INCOME',
    sortOrder: 4,
    categories: ['Vale-alimentação', 'Vale-refeição', 'Auxílio-creche/educação'],
  },
];

/**
 * Seeds the global, read-only category catalog (categoryGroups + categories)
 * into Firestore. Uses deterministic, slugified document IDs and `.set()`
 * (never `.add()`), so calling this more than once is always safe — it just
 * re-writes the same documents instead of creating duplicates (the exact
 * footgun that bit the equivalent Postgres insert-based seed once already).
 */
export async function seedCategoryCatalog(): Promise<{ groups: number; categories: number }> {
  const db = getAdminDb();
  const batch = db.batch();
  let categoryCount = 0;

  for (const group of GROUPS) {
    const groupId = slugify(group.name);
    const groupDoc: CategoryGroupDoc = { name: group.name, kind: group.kind, sortOrder: group.sortOrder };
    batch.set(db.doc(`categoryGroups/${groupId}`), groupDoc);

    group.categories.forEach((name, index) => {
      const categoryId = `${groupId}--${slugify(name)}`;
      batch.set(db.doc(`categories/${categoryId}`), {
        groupId,
        name,
        kind: group.kind,
        sortOrder: index + 1,
      });
      categoryCount++;
    });
  }

  await batch.commit();
  return { groups: GROUPS.length, categories: categoryCount };
}
