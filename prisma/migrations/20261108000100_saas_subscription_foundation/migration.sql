-- Additive tenant-isolated SaaS plans, subscriptions, orders and audit events.
-- Deliberately does not modify existing organizations or payroll data.
CREATE TYPE "SubscriptionTier" AS ENUM ('BASIC','PRO');
CREATE TYPE "SubscriptionBillingInterval" AS ENUM ('MONTHLY','YEARLY');
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING','ACTIVE','PAST_DUE','EXPIRED','CANCELLED');
CREATE TYPE "SubscriptionSource" AS ENUM ('GATEWAY','COMPLIMENTARY','LEGACY');
CREATE TYPE "SubscriptionOrderStatus" AS ENUM ('PENDING','PAID','FAILED','CANCELLED','EXPIRED');
CREATE TYPE "SubscriptionPaymentProvider" AS ENUM ('XENDIT','PAYMONGO');

CREATE TABLE "SubscriptionPlan" (
 "tier" "SubscriptionTier" PRIMARY KEY,
 "name" TEXT NOT NULL,
 "description" TEXT NOT NULL,
 "monthlyPriceMinor" INTEGER,
 "yearlyPriceMinor" INTEGER,
 "maxEmployees" INTEGER,
 "aiResumeParsing" BOOLEAN NOT NULL DEFAULT false,
 "advancedAnalytics" BOOLEAN NOT NULL DEFAULT false,
 "gmailIntegration" BOOLEAN NOT NULL DEFAULT false,
 "customBranding" BOOLEAN NOT NULL DEFAULT false,
 "active" BOOLEAN NOT NULL DEFAULT false,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SubscriptionPlan_monthly_nonnegative" CHECK ("monthlyPriceMinor" IS NULL OR "monthlyPriceMinor" >= 0),
 CONSTRAINT "SubscriptionPlan_yearly_nonnegative" CHECK ("yearlyPriceMinor" IS NULL OR "yearlyPriceMinor" >= 0),
 CONSTRAINT "SubscriptionPlan_employee_limit_positive" CHECK ("maxEmployees" IS NULL OR "maxEmployees" > 0)
);
CREATE TABLE "OrganizationSubscription" (
 "organizationId" TEXT PRIMARY KEY,
 "planTier" "SubscriptionTier" NOT NULL,
 "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
 "source" "SubscriptionSource" NOT NULL,
 "billingInterval" "SubscriptionBillingInterval",
 "startsAt" TIMESTAMP(3),
 "endsAt" TIMESTAMP(3),
 "cancelledAt" TIMESTAMP(3),
 "updatedAt" TIMESTAMP(3) NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "OrganizationSubscription_status_endsAt_idx" ON "OrganizationSubscription"("status", "endsAt");

CREATE TABLE "SubscriptionOrder" (
 "id" TEXT PRIMARY KEY,
 "organizationId" TEXT NOT NULL,
 "planTier" "SubscriptionTier" NOT NULL,
 "interval" "SubscriptionBillingInterval" NOT NULL,
 "amountMinor" INTEGER NOT NULL,
 "currency" TEXT NOT NULL DEFAULT 'PHP',
 "status" "SubscriptionOrderStatus" NOT NULL DEFAULT 'PENDING',
 "provider" "SubscriptionPaymentProvider",
 "providerSessionId" TEXT UNIQUE,
 "checkoutUrl" TEXT,
 "expiresAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 "paidAt" TIMESTAMP(3),
 CONSTRAINT "SubscriptionOrder_amount_positive" CHECK ("amountMinor" > 0),
 CONSTRAINT "SubscriptionOrder_currency_php" CHECK ("currency" = 'PHP')
);
CREATE INDEX "SubscriptionOrder_organizationId_createdAt_idx" ON "SubscriptionOrder"("organizationId","createdAt");
CREATE INDEX "SubscriptionOrder_status_expiresAt_idx" ON "SubscriptionOrder"("status","expiresAt");

CREATE TABLE "SubscriptionEvent" (
 "id" TEXT PRIMARY KEY,
 "organizationId" TEXT NOT NULL,
 "orderId" TEXT,
 "actorAdministratorId" TEXT,
 "action" TEXT NOT NULL,
 "operationKey" TEXT UNIQUE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SubscriptionEvent_organizationId_createdAt_idx" ON "SubscriptionEvent"("organizationId","createdAt");
CREATE INDEX "SubscriptionEvent_orderId_createdAt_idx" ON "SubscriptionEvent"("orderId","createdAt");
ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_planTier_fkey" FOREIGN KEY ("planTier") REFERENCES "SubscriptionPlan"("tier") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionOrder" ADD CONSTRAINT "SubscriptionOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionOrder" ADD CONSTRAINT "SubscriptionOrder_planTier_fkey" FOREIGN KEY ("planTier") REFERENCES "SubscriptionPlan"("tier") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SubscriptionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_actorAdministratorId_fkey" FOREIGN KEY ("actorAdministratorId") REFERENCES "PlatformAdministrator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Plan flags are illustrative defaults pending business approval. No active paid plan
-- or chargeable price is inserted automatically.
INSERT INTO "SubscriptionPlan" ("tier","name","description","aiResumeParsing","advancedAnalytics","gmailIntegration","customBranding","active","updatedAt") VALUES
 ('BASIC','Basic','Core workforce management; prices and limits require approval',false,false,false,false,false,CURRENT_TIMESTAMP),
 ('PRO','Pro','Core workforce management with advanced services; prices require approval',true,true,true,true,false,CURRENT_TIMESTAMP);
