-- Employee-specific PHP attendance rates and payslip notification preference.
-- Nullable rates preserve existing compensation records; new configuration requires all four.
ALTER TABLE "EmployeeCompensation"
  ADD COLUMN "overtimePayPerHour" DECIMAL(12,2),
  ADD COLUMN "undertimeDeductionPerHour" DECIMAL(12,2),
  ADD COLUMN "lateDeductionPerMinute" DECIMAL(12,2),
  ADD COLUMN "absenceDeductionPerDay" DECIMAL(12,2),
  ADD COLUMN "notifyOnPayslipReady" BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE "EmployeeCompensation"
  ADD CONSTRAINT "EmployeeCompensation_attendance_rates_positive_check"
  CHECK (
    ("overtimePayPerHour" IS NULL OR "overtimePayPerHour" > 0) AND
    ("undertimeDeductionPerHour" IS NULL OR "undertimeDeductionPerHour" > 0) AND
    ("lateDeductionPerMinute" IS NULL OR "lateDeductionPerMinute" > 0) AND
    ("absenceDeductionPerDay" IS NULL OR "absenceDeductionPerDay" > 0)
  );
