CREATE TYPE "BudgetPolicy" AS ENUM ('WARN', 'BLOCK');
ALTER TABLE "Department" ADD COLUMN "overBudgetPolicy" "BudgetPolicy" NOT NULL DEFAULT 'WARN';
