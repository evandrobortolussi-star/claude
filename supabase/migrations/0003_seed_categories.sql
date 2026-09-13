-- Financeiro Familiar — Etapa 2: categorias iniciais
--
-- Exactly the groups/categories the product spec calls for — deliberately
-- not padded out further ("não criar dezenas de categorias desnecessárias").

insert into public.category_groups (name, kind, sort_order) values
  ('Moradia & Habitação', 'EXPENSE', 1),
  ('Educação dos filhos', 'EXPENSE', 2),
  ('Alimentação & Mercado', 'EXPENSE', 3),
  ('Saúde & Seguros', 'EXPENSE', 4),
  ('Transporte & Veículos', 'EXPENSE', 5),
  ('Estilo de vida, Lazer & Vestuário', 'EXPENSE', 6),
  ('Despesas pessoais dos cônjuges', 'EXPENSE', 7),
  ('Renda principal', 'INCOME', 1),
  ('Renda variável / extra', 'INCOME', 2),
  ('Renda passiva / patrimonial', 'INCOME', 3),
  ('Benefícios corporativos', 'INCOME', 4);

insert into public.categories (group_id, name, kind, sort_order)
select g.id, c.name, g.kind, c.sort_order
from public.category_groups g
join (values
  ('Moradia & Habitação', 'Financiamento imobiliário', 1),
  ('Moradia & Habitação', 'Aluguel', 2),
  ('Moradia & Habitação', 'Condomínio', 3),
  ('Moradia & Habitação', 'IPTU', 4),
  ('Moradia & Habitação', 'Energia elétrica', 5),
  ('Moradia & Habitação', 'Água', 6),
  ('Moradia & Habitação', 'Gás', 7),
  ('Moradia & Habitação', 'Internet', 8),
  ('Moradia & Habitação', 'Manutenção/reparos residenciais', 9),

  ('Educação dos filhos', 'Mensalidade escolar', 1),
  ('Educação dos filhos', 'Cursos extracurriculares', 2),
  ('Educação dos filhos', 'Idiomas', 3),
  ('Educação dos filhos', 'Esportes', 4),
  ('Educação dos filhos', 'Material escolar', 5),
  ('Educação dos filhos', 'Uniformes', 6),
  ('Educação dos filhos', 'Transporte escolar', 7),
  ('Educação dos filhos', 'Matrícula/rematrícula', 8),

  ('Alimentação & Mercado', 'Supermercado', 1),
  ('Alimentação & Mercado', 'Feira', 2),
  ('Alimentação & Mercado', 'Açougue', 3),
  ('Alimentação & Mercado', 'Higiene', 4),
  ('Alimentação & Mercado', 'Limpeza da casa', 5),

  ('Saúde & Seguros', 'Plano de saúde', 1),
  ('Saúde & Seguros', 'Consultas', 2),
  ('Saúde & Seguros', 'Exames', 3),
  ('Saúde & Seguros', 'Farmácia', 4),
  ('Saúde & Seguros', 'Seguro de vida', 5),
  ('Saúde & Seguros', 'Seguro residencial', 6),

  ('Transporte & Veículos', 'Financiamento', 1),
  ('Transporte & Veículos', 'Combustível', 2),
  ('Transporte & Veículos', 'Seguro auto', 3),
  ('Transporte & Veículos', 'IPVA', 4),
  ('Transporte & Veículos', 'Licenciamento', 5),
  ('Transporte & Veículos', 'Manutenção', 6),
  ('Transporte & Veículos', 'Estacionamento', 7),
  ('Transporte & Veículos', 'Pedágios', 8),

  ('Estilo de vida, Lazer & Vestuário', 'Passeios', 1),
  ('Estilo de vida, Lazer & Vestuário', 'Restaurantes', 2),
  ('Estilo de vida, Lazer & Vestuário', 'Delivery', 3),
  ('Estilo de vida, Lazer & Vestuário', 'Viagens', 4),
  ('Estilo de vida, Lazer & Vestuário', 'Streaming', 5),
  ('Estilo de vida, Lazer & Vestuário', 'Vestuário', 6),
  ('Estilo de vida, Lazer & Vestuário', 'Calçados', 7),

  ('Despesas pessoais dos cônjuges', 'Cônjuge 1', 1),
  ('Despesas pessoais dos cônjuges', 'Cônjuge 2', 2),

  ('Renda principal', 'Salário CLT', 1),
  ('Renda principal', 'Pró-labore', 2),
  ('Renda principal', 'Faturamento recorrente PJ', 3),

  ('Renda variável / extra', 'Comissão', 1),
  ('Renda variável / extra', 'Hora extra', 2),
  ('Renda variável / extra', 'PLR', 3),
  ('Renda variável / extra', 'Bonificação', 4),
  ('Renda variável / extra', 'Consultoria avulsa', 5),

  ('Renda passiva / patrimonial', 'Aluguel recebido', 1),
  ('Renda passiva / patrimonial', 'Dividendos', 2),
  ('Renda passiva / patrimonial', 'Juros sobre capital próprio', 3),
  ('Renda passiva / patrimonial', 'Rendimentos de aplicações', 4),

  ('Benefícios corporativos', 'Vale-alimentação', 1),
  ('Benefícios corporativos', 'Vale-refeição', 2),
  ('Benefícios corporativos', 'Auxílio-creche/educação', 3)
) as c(group_name, name, sort_order) on c.group_name = g.name;
