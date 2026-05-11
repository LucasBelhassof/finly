type AccountWithType = {
  accountType?: string | null;
};

export function isUsefulOnboardingAccountType(accountType: string | null | undefined) {
  return accountType === "bank_account" || accountType === "credit_card";
}

export function hasUsefulOnboardingAccount(accounts: AccountWithType[]) {
  return accounts.some((account) => isUsefulOnboardingAccountType(account.accountType));
}

export function hasCompletedInitialSetup(input: { accounts: AccountWithType[]; transactionCount: number }) {
  return hasUsefulOnboardingAccount(input.accounts) && input.transactionCount > 0;
}

export function isInitialSetupIncomplete(input: { accounts: AccountWithType[]; transactionCount: number }) {
  return !hasCompletedInitialSetup(input);
}
