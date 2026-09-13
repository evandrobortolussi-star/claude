'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/session';
import { parseBRLToCents } from '@/lib/format';

const loanSchema = z.object({
  kind: z.enum(['LOAN', 'FINANCING']),
  name: z.string().trim().min(1, 'Informe um nome.'),
  institution: z.string().trim().optional(),
  contractedAmount: z.string().min(1, 'Informe o valor contratado.'),
  installmentAmount: z.string().min(1, 'Informe o valor da parcela.'),
  installmentsTotal: z.coerce.number().int().min(1),
  interestRateMonthly: z.string().optional(),
  dueDay: z.string().optional(),
  contractedOn: z.string().min(1),
});

export async function createLoan(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = loanSchema.parse(Object.fromEntries(formData));
  const supabase = createClient();

  const contractedAmountCents = parseBRLToCents(parsed.contractedAmount);

  const { error } = await supabase.from('loans').insert({
    household_id: user.householdId,
    kind: parsed.kind,
    name: parsed.name,
    institution: parsed.institution || null,
    contracted_amount_cents: contractedAmountCents,
    outstanding_balance_cents: contractedAmountCents,
    installment_amount_cents: parseBRLToCents(parsed.installmentAmount),
    installments_total: parsed.installmentsTotal,
    interest_rate_monthly: parsed.interestRateMonthly ? Number(parsed.interestRateMonthly.replace(',', '.')) : null,
    due_day: parsed.dueDay ? Number(parsed.dueDay) : null,
    contracted_on: parsed.contractedOn,
  });

  if (error) throw new Error('Não foi possível criar o empréstimo/financiamento.');

  revalidatePath('/loans');
  redirect('/loans');
}

export async function archiveLoan(id: string) {
  await requireCurrentUser();
  const supabase = createClient();
  await supabase.from('loans').update({ archived: true }).eq('id', id);
  revalidatePath('/loans');
}

const paymentSchema = z.object({
  amount: z.string().min(1, 'Informe o valor.'),
  occurredOn: z.string().min(1, 'Informe a data.'),
  accountId: z.string().optional(),
  notes: z.string().trim().optional(),
});

export async function createLoanPayment(loanId: string, formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = paymentSchema.parse(Object.fromEntries(formData));
  const supabase = createClient();

  const { error } = await supabase.from('loan_payments').insert({
    household_id: user.householdId,
    loan_id: loanId,
    amount_cents: parseBRLToCents(parsed.amount),
    occurred_on: parsed.occurredOn,
    account_id: parsed.accountId || null,
    notes: parsed.notes || null,
  });

  if (error) throw new Error('Não foi possível registrar o pagamento.');

  revalidatePath(`/loans/${loanId}`);
  revalidatePath('/loans');
}

export async function deleteLoanPayment(loanId: string, paymentId: string) {
  await requireCurrentUser();
  const supabase = createClient();
  await supabase.from('loan_payments').update({ deleted_at: new Date().toISOString() }).eq('id', paymentId);
  revalidatePath(`/loans/${loanId}`);
  revalidatePath('/loans');
}
