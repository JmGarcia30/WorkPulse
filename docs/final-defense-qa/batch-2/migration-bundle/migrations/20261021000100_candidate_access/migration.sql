CREATE TABLE "CandidateAccess" (
 "applicationId" TEXT NOT NULL,
 "linkHash" TEXT,
 "linkExpiresAt" TIMESTAMP(3),
 "delivered" BOOLEAN NOT NULL DEFAULT false,
 "sessionHash" TEXT,
 "sessionExpiresAt" TIMESTAMP(3),
 "revoked" BOOLEAN NOT NULL DEFAULT false,
 "lastSentAt" TIMESTAMP(3),
 "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "sendCount" INTEGER NOT NULL DEFAULT 0,
 CONSTRAINT "CandidateAccess_pkey" PRIMARY KEY ("applicationId"),
 CONSTRAINT "CandidateAccess_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CandidateAccess_linkHash_key" ON "CandidateAccess"("linkHash");
CREATE UNIQUE INDEX "CandidateAccess_sessionHash_key" ON "CandidateAccess"("sessionHash");
