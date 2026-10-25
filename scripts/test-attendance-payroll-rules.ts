import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AttendanceDisposition, AttendanceStatus } from '@prisma/client';
import { calculateAttendanceDurations, instantForLocalSecond, summarizeAttendanceIndicators } from '../src/features/attendance/domain';
import { attendanceReadinessIssue, payrollAttendanceEvidence, type PayrollAttendanceFact } from '../src/features/payroll/attendance-evidence';

let assertions = 0;
const check = (condition: unknown, message: string) => { assert(condition, message); assertions++; console.log(`PASS ${assertions}: ${message}`); };
const days = (dates: string[]) => dates.map(attendanceDate => ({ attendanceDate, status: AttendanceStatus.PRESENT, lateSeconds: 60 }));
check(!summarizeAttendanceIndicators(days(['2026-09-01', '2026-09-02', '2026-09-03'])).habitualTardinessReview, 'three monthly late days do not meet the threshold');
check(summarizeAttendanceIndicators(days(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'])).habitualTardinessReview, 'four monthly late days meet the threshold');
check(!summarizeAttendanceIndicators(days(['2026-09-01', '2026-09-02', '2026-10-01', '2026-10-02'])).habitualTardinessReview, 'two plus two across months is not habitual tardiness');
check(summarizeAttendanceIndicators(days(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-10-01'])).habitualTardinessReview, 'one qualifying month is found within a longer range');

const instant = (second: number) => instantForLocalSecond('2026-09-03', second, 'Asia/Manila');
const duration = (arrival: number, grace: number) => calculateAttendanceDurations({ attendanceDate: '2026-09-03', timeZone: 'Asia/Manila', scheduledStartAt: instant(28800), scheduledEndAt: instant(61200), lateGraceSeconds: grace, breaks: [{ startSecond: 43200, endSecond: 46800, isPaid: false }], firstTimeIn: instant(arrival), lastTimeOut: instant(59400) });
check(duration(29700, 900).lateSeconds === 0, '15-minute grace boundary is inclusive');
check(duration(29701, 900).lateSeconds === 1, 'one second beyond grace retains exact seconds');
check(duration(30000, 900).lateSeconds === 300, '20-minute arrival delay minus configured 15-minute grace is five late minutes');
check(duration(30000, 0).lateSeconds === 1200, 'zero grace retains all 20 late minutes');
check(duration(30000, 900).undertimeSeconds === 1800 && duration(30000, 900).workedSeconds === 25800, '30-minute undertime and unpaid-lunch exclusion remain correct');

const facts: PayrollAttendanceFact[] = [
  { attendanceDate: new Date('2026-09-01Z'), attendanceStatus: 'PRESENT', disposition: 'NORMAL', lateSeconds: 60, undertimeSeconds: 120 },
  { attendanceDate: new Date('2026-09-02Z'), attendanceStatus: 'ABSENT', disposition: 'NORMAL', lateSeconds: null, undertimeSeconds: null },
];
check(payrollAttendanceEvidence(facts) === payrollAttendanceEvidence([...facts].reverse()), 'row order cannot falsely invalidate payroll evidence');
for (const [field, changed] of [
  ['lateness', { ...facts[0], lateSeconds: 120 }],
  ['undertime', { ...facts[0], undertimeSeconds: 0 }],
  ['status', { ...facts[0], attendanceStatus: AttendanceStatus.ABSENT }],
  ['approved leave', { ...facts[0], disposition: AttendanceDisposition.APPROVED_LEAVE }],
  ['date', { ...facts[0], attendanceDate: new Date('2026-09-03Z') }],
] as const) check(payrollAttendanceEvidence(facts) !== payrollAttendanceEvidence([changed, facts[1]]), `${field} changes invalidate the consumed payroll evidence`);
check(attendanceReadinessIssue(facts, 2) === null, 'resolved present/absent records are eligible attendance inputs');
check(attendanceReadinessIssue(facts, 3)?.includes('all 3 calendar days'), 'missing materialized days are blocked');
check(attendanceReadinessIssue([{ ...facts[0], attendanceStatus: 'NO_SCHEDULE' }], 1)?.includes('schedule'), 'missing schedules are blocked for attendance policies');
for (const attendanceStatus of [AttendanceStatus.OPEN, AttendanceStatus.INCOMPLETE]) check(attendanceReadinessIssue([{ ...facts[0], attendanceStatus }], 1)?.includes('unresolved'), `${attendanceStatus} inputs are blocked for attendance policies`);
fs.mkdirSync('docs/rfid/integration-audit', { recursive: true });
fs.writeFileSync('docs/rfid/integration-audit/rules-regression.json', JSON.stringify({ assertions, passed: true, databaseConnections: 0, ratesIntroduced: false }, null, 2) + '\n');
