'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireCurrentUser } from '@/lib/session';
import { parseBRLToCents } from '@/lib/format';
import * as loansDb from '@/lib/firestore/loans';

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
  const contractedAmountCents = parseBRLToCents(parsed.contractedAmount);

  await loansDb.createLoan(user.householdId, {
    kind: parsed.kind,
    name: parsed.name,
    institution: parsed.institution || null,
    contractedAmountCents,
    installmentAmountCents: parseBRLToCents(parsed.installmentAmount),
    installmentsTotal: parsed.installmentsTotal,
    interestRateMonthly: parsed.interestRateMonthly ? Number(parsed.interestRateMonthly.replace(',', '.')) : null,
    dueDay: parsed.dueDay ? Number(parsed.dueDay) : null,
    contractedOn: parsed.contractedOn,
  });

  revalidatePath('/loans');
  redirect('/loans');
}

export async function archiveLoan(id: string) {
  const user = await requireCurrentUser();
  await loansDb.archiveLoan(user.householdId, id);
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

  await loansDb.createLoanPayment(user.householdId, user.id, loanId, {
    amountCents: parseBRLToCents(parsed.amount),
    occurredOn: parsed.occurredOn,
    accountId: parsed.accountId || null,
    notes: parsed.notes || null,
  });

  revalidatePath(`/loans/${loanId}`);
  revalidatePath('/loans');
}

export async function deleteLoanPayment(loanId: string, paymentId: string) {
  const user = await requireCurrentUser();
  await loansDb.softDeleteLoanPayment(user.householdId, loanId, paymentId);
  revalidatePath(`/loans/${loanId}`);
  revalidatePath('/loans');
}
