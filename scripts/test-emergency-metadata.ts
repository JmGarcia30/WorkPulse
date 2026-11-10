import assert from 'node:assert/strict';
import { stableAttendanceMetadata } from '../src/features/attendance/service';

const initial = {
  purpose: 'EMERGENCY_ATTENDANCE_RECOVERY',
  incident: 'POWER_OUTAGE',
  evidenceReference: 'Paper logbook 4',
  notes: 'Power was out',
  attendanceDate: '2026-11-10',
};

const jsonbReordered = {
  notes: 'Power was out',
  purpose: 'EMERGENCY_ATTENDANCE_RECOVERY',
  attendanceDate: '2026-11-10',
  evidenceReference: 'Paper logbook 4',
  incident: 'POWER_OUTAGE',
};

assert.equal(stableAttendanceMetadata(initial), stableAttendanceMetadata(jsonbReordered));
assert.notEqual(stableAttendanceMetadata(initial), stableAttendanceMetadata({ ...jsonbReordered, notes: 'Different evidence' }));
assert.equal(
  stableAttendanceMetadata({ extra: { b: 1, a: ['one', { y: 2, x: 1 }] } }),
  stableAttendanceMetadata({ extra: { a: ['one', { x: 1, y: 2 }], b: 1 } }),
);
assert.equal(stableAttendanceMetadata(null), stableAttendanceMetadata(undefined));
console.log('PASS: attendance JSONB metadata equality is stable and rejects different evidence.');
