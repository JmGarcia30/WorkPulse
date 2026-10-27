'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  assignScheduleAction,
  createScheduleVersionAction,
  archiveScheduleGroupAction,
  deleteScheduleVersionAction,
  deleteScheduleGroupAction,
  removeScheduleAssignmentAction,
} from '@/features/attendance/actions';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import {
  Clock,
  Archive,
  ArchiveRestore,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Users,
  Shield,
  Layers,
} from 'lucide-react';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const seconds = (value: string) => {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 3600 + minute * 60;
};

export interface ScheduleVersionItem {
  id: string;
  version: number;
  displayName: string;
  lateGraceSeconds: number;
  assignmentsCount: number;
}

export interface ScheduleGroupItem {
  id: string;
  scheduleKey: string;
  name: string;
  description?: string | null;
  isArchived: boolean;
  versions: ScheduleVersionItem[];
}

export interface EmployeeAssignmentItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  scheduleName: string;
  scheduleKey: string;
  versionNumber: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: 'UPCOMING' | 'ACTIVE' | 'PAST';
  isDeletable: boolean;
  ineligibleReason?: string;
}

interface ScheduleManagerProps {
  groups: ScheduleGroupItem[];
  employees: Array<{ id: string; employeeNumber: string; firstName: string; lastName: string }>;
  assignments?: EmployeeAssignmentItem[];
}

export function ScheduleManager({ groups, employees, assignments = [] }: ScheduleManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Create Version Form State
  const [scheduleKey, setScheduleKey] = useState('');
  const selected = groups.find((group) => group.scheduleKey === scheduleKey);
  const [name, setName] = useState('');
  const [workdays, setWorkdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('18:00');
  const [breakStart, setBreakStart] = useState('12:00');
  const [breakEnd, setBreakEnd] = useState('13:00');
  const [grace, setGrace] = useState(0);

  // Assign Schedule Form State
  const [employeeId, setEmployeeId] = useState('');
  const [versionId, setVersionId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');

  // Messages & Feedback
  const [feedback, setFeedback] = useState<{ error?: string; success?: string } | null>(null);

  // Active (non-archived) groups for new assignments
  const activeGroups = useMemo(() => groups.filter((g) => !g.isArchived), [groups]);
  const assignableVersions = useMemo(
    () =>
      activeGroups.flatMap((group) =>
        group.versions.map((version) => ({
          ...version,
          groupName: group.name,
        }))
      ),
    [activeGroups]
  );

  // Confirmation Modals State
  const [versionToDelete, setVersionToDelete] = useState<{
    id: string;
    version: number;
    displayName: string;
    groupName: string;
  } | null>(null);

  const [groupToArchive, setGroupToArchive] = useState<{
    id: string;
    name: string;
    isArchived: boolean;
  } | null>(null);

  const [groupToDelete, setGroupToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [assignmentToDelete, setAssignmentToDelete] = useState<EmployeeAssignmentItem | null>(null);
  const [isActionBusy, setIsActionBusy] = useState(false);

  // Handlers
  const handleArchiveGroupConfirm = async () => {
    if (!groupToArchive || isActionBusy) return;
    setIsActionBusy(true);
    setFeedback(null);
    try {
      const result = await archiveScheduleGroupAction({
        scheduleGroupId: groupToArchive.id,
        isArchived: !groupToArchive.isArchived,
      });
      if (!result.success) {
        setFeedback({ error: result.error });
      } else {
        const msg = (result as { message?: string }).message;
        setFeedback({
          success: msg || (groupToArchive.isArchived ? 'Schedule unarchived.' : 'Schedule archived.'),
        });
        setGroupToArchive(null);
        router.refresh();
      }
    } catch (err) {
      setFeedback({ error: err instanceof Error ? err.message : 'Failed to update schedule archive status.' });
    } finally {
      setIsActionBusy(false);
    }
  };

  const handleDeleteVersionConfirm = async () => {
    if (!versionToDelete || isActionBusy) return;
    setIsActionBusy(true);
    setFeedback(null);
    try {
      const result = await deleteScheduleVersionAction({
        scheduleVersionId: versionToDelete.id,
      });
      if (!result.success) {
        setFeedback({ error: result.error });
      } else {
        const msg = (result as { message?: string }).message;
        setFeedback({ success: msg || 'Schedule version deleted.' });
        setVersionToDelete(null);
        router.refresh();
      }
    } catch (err) {
      setFeedback({ error: err instanceof Error ? err.message : 'Failed to delete schedule version.' });
    } finally {
      setIsActionBusy(false);
    }
  };

  const handleDeleteGroupConfirm = async () => {
    if (!groupToDelete || isActionBusy) return;
    setIsActionBusy(true);
    setFeedback(null);
    try {
      const result = await deleteScheduleGroupAction({
        scheduleGroupId: groupToDelete.id,
      });
      if (!result.success) {
        setFeedback({ error: result.error });
      } else {
        const msg = (result as { message?: string }).message;
        setFeedback({ success: msg || 'Schedule deleted.' });
        setGroupToDelete(null);
        router.refresh();
      }
    } catch (err) {
      setFeedback({ error: err instanceof Error ? err.message : 'Failed to delete schedule.' });
    } finally {
      setIsActionBusy(false);
    }
  };

  const handleRemoveAssignmentConfirm = async () => {
    if (!assignmentToDelete || isActionBusy) return;
    setIsActionBusy(true);
    setFeedback(null);
    try {
      const result = await removeScheduleAssignmentAction({
        assignmentId: assignmentToDelete.id,
      });
      if (!result.success) {
        setFeedback({ error: result.error });
      } else {
        const msg = (result as { message?: string }).message;
        setFeedback({
          success: msg || `Future assignment for ${assignmentToDelete.employeeName} removed.`,
        });
        setAssignmentToDelete(null);
        router.refresh();
      }
    } catch (err) {
      setFeedback({ error: err instanceof Error ? err.message : 'Failed to remove schedule assignment.' });
    } finally {
      setIsActionBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Global Feedback Alert */}
      {feedback?.error && (
        <div role="alert" className="flex items-center gap-2 rounded-[6px] bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{feedback.error}</span>
        </div>
      )}
      {feedback?.success && (
        <div role="status" className="flex items-center gap-2 rounded-[6px] bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{feedback.success}</span>
        </div>
      )}

      {/* Top Creation & Assignment Forms */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Form 1: Create Schedule Version */}
        <form
          className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs"
          onSubmit={(event) => {
            event.preventDefault();
            setFeedback(null);
            startTransition(async () => {
              const result = await createScheduleVersionAction({
                scheduleKey: scheduleKey || undefined,
                name: name || selected?.name || '',
                lateGraceSeconds: grace,
                days: weekdays.map((_, index) => ({
                  isoWeekday: index + 1,
                  isWorkday: workdays.includes(index + 1),
                  expectedStartSecond: workdays.includes(index + 1) ? seconds(start) : null,
                  expectedEndSecond: workdays.includes(index + 1) ? seconds(end) : null,
                  breaks:
                    workdays.includes(index + 1) && breakStart && breakEnd
                      ? [{ startSecond: seconds(breakStart), endSecond: seconds(breakEnd), isPaid: false }]
                      : [],
                })),
              });
              if (result.success) {
                setFeedback({ success: 'Immutable schedule version created successfully.' });
                setName('');
                setScheduleKey('');
                router.refresh();
              } else {
                setFeedback({ error: result.error });
              }
            });
          }}
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--tenant-primary,#0f766e)]">
            <Clock className="h-4 w-4 text-[#C7A759]" />
            <span>Schedule Configuration</span>
          </div>
          <h2 className="text-sm font-bold text-[#282934]">Create Schedule Version</h2>

          <select
            value={scheduleKey}
            onChange={(event) => {
              setScheduleKey(event.target.value);
              setName(groups.find((group) => group.scheduleKey === event.target.value)?.name ?? '');
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#282934] focus:border-[#C7A759] focus:outline-none"
          >
            <option value="">New logical schedule</option>
            {groups.map((group) => (
              <option key={group.scheduleKey} value={group.scheduleKey}>
                {group.name} {group.isArchived ? '(Archived)' : '— next version'}
              </option>
            ))}
          </select>

          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Schedule name (e.g. Standard Shift 9-6)"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#282934] focus:border-[#C7A759] focus:outline-none"
          />

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500">Working Days</label>
            <div className="flex flex-wrap gap-2">
              {weekdays.map((day, index) => (
                <label key={day} className="flex items-center gap-1.5 text-xs text-[#282934] cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded text-[#282934] focus:ring-[#C7A759]"
                    checked={workdays.includes(index + 1)}
                    onChange={() =>
                      setWorkdays((current) =>
                        current.includes(index + 1) ? current.filter((value) => value !== index + 1) : [...current, index + 1]
                      )
                    }
                  />
                  <span>{day.slice(0, 3)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-slate-500 block mb-1">Expected Start</label>
              <input
                aria-label="Expected start"
                type="time"
                required={workdays.length > 0}
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#282934]"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 block mb-1">Expected End</label>
              <input
                aria-label="Expected end"
                type="time"
                required={workdays.length > 0}
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#282934]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-slate-500 block mb-1">Break Start</label>
              <input
                aria-label="Unpaid break start"
                type="time"
                value={breakStart}
                onChange={(event) => setBreakStart(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#282934]"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 block mb-1">Break End</label>
              <input
                aria-label="Unpaid break end"
                type="time"
                value={breakEnd}
                onChange={(event) => setBreakEnd(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#282934]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600 font-medium">
              Late grace period (seconds)
            </label>
            <input
              type="number"
              min={0}
              value={grace}
              onChange={(event) => setGrace(Number(event.target.value))}
              className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-[#282934]"
            />
          </div>

          <button
            disabled={pending}
            className="w-full rounded-xl bg-[#282934] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#181923] disabled:opacity-50 transition"
          >
            {pending ? 'Saving...' : 'Create Immutable Version'}
          </button>
        </form>

        {/* Form 2: Assign Schedule */}
        <form
          className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs"
          onSubmit={(event) => {
            event.preventDefault();
            setFeedback(null);
            startTransition(async () => {
              const result = await assignScheduleAction({
                employeeId,
                scheduleVersionId: versionId,
                effectiveFrom,
                effectiveTo: effectiveTo || null,
              });
              if (result.success) {
                setFeedback({ success: 'Schedule assigned to employee successfully.' });
                setEmployeeId('');
                setVersionId('');
                setEffectiveFrom('');
                setEffectiveTo('');
                router.refresh();
              } else {
                setFeedback({ error: result.error });
              }
            });
          }}
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--tenant-primary,#0f766e)]">
            <Users className="h-4 w-4 text-[#C7A759]" />
            <span>Employee Assignment</span>
          </div>
          <h2 className="text-sm font-bold text-[#282934]">Assign Schedule Version</h2>

          <div>
            <label className="text-[11px] font-medium text-slate-500 block mb-1">Select Employee</label>
            <select
              required
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#282934] focus:border-[#C7A759] focus:outline-none"
            >
              <option value="">Choose an employee...</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employeeNumber} — {employee.firstName} {employee.lastName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-500 block mb-1">
              Active Schedule Version (Archived schedules excluded)
            </label>
            <select
              required
              value={versionId}
              onChange={(event) => setVersionId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#282934] focus:border-[#C7A759] focus:outline-none"
            >
              <option value="">Choose active version...</option>
              {assignableVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.groupName} — {version.displayName} (v{version.version})
                </option>
              ))}
            </select>
            {assignableVersions.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1">
                No active schedules available. Please create or unarchive a schedule.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-slate-500 block mb-1">Effective From</label>
              <input
                aria-label="Effective from"
                type="date"
                required
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#282934]"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 block mb-1">
                Effective To <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                aria-label="Effective to exclusive"
                title="Exclusive end date"
                type="date"
                value={effectiveTo}
                onChange={(event) => setEffectiveTo(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#282934]"
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            Note: Once an assignment becomes active and attendance is logged, it cannot be deleted destructively. Set an end date to conclude it safely.
          </p>

          <button
            disabled={pending || assignableVersions.length === 0}
            className="w-full rounded-xl bg-[#282934] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#181923] disabled:opacity-50 transition"
          >
            {pending ? 'Assigning...' : 'Assign Schedule'}
          </button>
        </form>
      </div>

      {/* Section 3: Work Schedules Management List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#C7A759]" />
            <h2 className="text-base font-bold text-[#282934]">
              Work Schedules ({groups.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {activeGroups.length} Active · {groups.length - activeGroups.length} Archived
          </span>
        </div>

        <div className="space-y-3">
          {groups.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 text-center text-xs text-slate-400">
              No work schedules configured yet.
            </div>
          ) : (
            groups.map((group) => {
              const totalAssignments = group.versions.reduce((sum, v) => sum + v.assignmentsCount, 0);
              const canDeleteGroup = totalAssignments === 0;

              return (
                <section
                  key={group.id}
                  className={`rounded-2xl border bg-white p-5 shadow-2xs transition ${
                    group.isArchived ? 'border-amber-200/70 bg-amber-50/20' : 'border-slate-200/80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-[#282934]">{group.name}</h3>
                        {group.isArchived ? (
                          <span className="rounded-[6px] bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                            Archived
                          </span>
                        ) : (
                          <span className="rounded-[6px] bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-mono">{group.scheduleKey}</p>
                      {group.description && (
                        <p className="text-xs text-slate-600">{group.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Archive / Unarchive Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setFeedback(null);
                          setGroupToArchive({
                            id: group.id,
                            name: group.name,
                            isArchived: group.isArchived,
                          });
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
                          group.isArchived
                            ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {group.isArchived ? (
                          <>
                            <ArchiveRestore className="h-3.5 w-3.5 text-amber-700" />
                            <span>Unarchive Schedule</span>
                          </>
                        ) : (
                          <>
                            <Archive className="h-3.5 w-3.5 text-slate-600" />
                            <span>Archive Schedule</span>
                          </>
                        )}
                      </button>

                      {/* Delete Unused Schedule Group */}
                      {canDeleteGroup ? (
                        <button
                          type="button"
                          onClick={() => {
                            setFeedback(null);
                            setGroupToDelete({
                              id: group.id,
                              name: group.name,
                            });
                          }}
                          title="Delete unused schedule"
                          aria-label={`Delete schedule ${group.name}`}
                          className="inline-flex items-center justify-center rounded-xl p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title="Cannot delete: this schedule has employee assignments. Please archive instead to deactivate."
                          aria-label={`Cannot delete schedule ${group.name}`}
                          className="inline-flex items-center justify-center rounded-xl p-1.5 text-slate-300 cursor-not-allowed transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Versions breakdown */}
                  <div className="mt-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                      Versions ({group.versions.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {group.versions.map((version) => {
                        const canDeleteVersion = version.assignmentsCount === 0;

                        return (
                          <div
                            key={version.id}
                            className="inline-flex items-center gap-2 rounded-[6px] bg-slate-100 px-3 py-1 text-xs text-[#282934]"
                          >
                            <span className="font-medium">
                              v{version.version} · grace {version.lateGraceSeconds}s · {version.assignmentsCount}{' '}
                              {version.assignmentsCount === 1 ? 'assignment' : 'assignments'}
                            </span>

                            {/* Small delete icon per version */}
                            {canDeleteVersion ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setFeedback(null);
                                  setVersionToDelete({
                                    id: version.id,
                                    version: version.version,
                                    displayName: version.displayName,
                                    groupName: group.name,
                                  });
                                }}
                                title="Delete unused version"
                                aria-label={`Delete version ${version.version}`}
                                className="text-red-600 hover:text-red-800 transition p-0.5 rounded"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <span
                                title="Version is assigned to employees and protected from deletion."
                                className="text-slate-400 cursor-default p-0.5"
                              >
                                <Shield className="h-3 w-3 text-slate-400" />
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })
          )}
        </div>
      </div>

      {/* Section 4: Employee Schedule Assignments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#C7A759]" />
            <h2 className="text-base font-bold text-[#282934]">
              Employee Schedule Assignments ({assignments.length})
            </h2>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            {assignments.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                No employee schedule assignments recorded yet. Use the assignment form above to schedule employees.
              </p>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2.5">Employee</th>
                    <th className="px-3.5 py-2.5">Schedule Version</th>
                    <th className="px-3.5 py-2.5">Effective Dates</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3.5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-2.5">
                        <span className="font-bold text-[#282934] block">
                          {assignment.employeeName}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {assignment.employeeNumber}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-700">
                        <span className="font-medium text-[#282934]">
                          {assignment.scheduleName}
                        </span>{' '}
                        <span className="text-[11px] text-slate-500">(v{assignment.versionNumber})</span>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600">
                        {assignment.effectiveFrom} – {assignment.effectiveTo || 'Present'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex rounded-[6px] px-2 py-0.5 text-[10px] font-semibold ${
                            assignment.status === 'UPCOMING'
                              ? 'bg-blue-50 text-blue-700'
                              : assignment.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {assignment.status === 'UPCOMING'
                            ? 'Future'
                            : assignment.status === 'ACTIVE'
                            ? 'Active'
                            : 'Past'}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        {assignment.isDeletable ? (
                          <button
                            type="button"
                            onClick={() => {
                              setFeedback(null);
                              setAssignmentToDelete(assignment);
                            }}
                            title="Remove unused future schedule assignment"
                            aria-label={`Remove assignment for ${assignment.employeeName}`}
                            className="inline-flex items-center justify-center rounded-[6px] p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 transition focus:outline-none focus:ring-2 focus:ring-red-500/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title={assignment.ineligibleReason || 'Cannot delete active or historical assignment.'}
                            aria-label={`Cannot remove assignment for ${assignment.employeeName}`}
                            className="inline-flex items-center justify-center rounded-[6px] p-1.5 text-slate-300 cursor-not-allowed transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal 1: Delete Schedule Version */}
      <ConfirmationDialog
        isOpen={versionToDelete !== null}
        onClose={() => {
          if (!isActionBusy) setVersionToDelete(null);
        }}
        onConfirm={handleDeleteVersionConfirm}
        title="Delete Schedule?"
        description="Are you sure you want to delete this unused schedule? This action cannot be undone."
        details={[
          { label: 'Schedule Group', value: versionToDelete?.groupName || '' },
          { label: 'Version', value: `Version ${versionToDelete?.version}` },
          { label: 'Display Name', value: versionToDelete?.displayName || '' },
        ]}
        confirmLabel="Delete Schedule"
        confirmVariant="danger"
        busy={isActionBusy}
      />

      {/* Confirmation Modal 2: Archive / Unarchive Schedule Group */}
      <ConfirmationDialog
        isOpen={groupToArchive !== null}
        onClose={() => {
          if (!isActionBusy) setGroupToArchive(null);
        }}
        onConfirm={handleArchiveGroupConfirm}
        title={groupToArchive?.isArchived ? 'Unarchive Work Schedule?' : 'Archive Work Schedule?'}
        description={
          groupToArchive?.isArchived
            ? 'Unarchiving this schedule will restore it to the assignment dropdown for new employee schedules.'
            : 'Archiving hides this schedule from new employee assignment options. All existing assignments, attendance calculations, and employee history are completely preserved.'
        }
        details={[
          { label: 'Schedule Name', value: groupToArchive?.name || '' },
          {
            label: 'Action',
            value: groupToArchive?.isArchived ? 'Restore to active' : 'Hide from new assignments',
          },
        ]}
        confirmLabel={groupToArchive?.isArchived ? 'Unarchive Schedule' : 'Archive Schedule'}
        confirmVariant="primary"
        warning={groupToArchive?.isArchived ? undefined : 'Historical employee attendance and leave will remain intact.'}
        busy={isActionBusy}
      />

      {/* Confirmation Modal 3: Delete Schedule Group */}
      <ConfirmationDialog
        isOpen={groupToDelete !== null}
        onClose={() => {
          if (!isActionBusy) setGroupToDelete(null);
        }}
        onConfirm={handleDeleteGroupConfirm}
        title="Delete Work Schedule?"
        description="Are you sure you want to delete this unused schedule? This action cannot be undone."
        details={[{ label: 'Schedule Name', value: groupToDelete?.name || '' }]}
        confirmLabel="Delete Schedule"
        confirmVariant="danger"
        busy={isActionBusy}
      />

      {/* Confirmation Modal 4: Remove Schedule Assignment */}
      <ConfirmationDialog
        isOpen={assignmentToDelete !== null}
        onClose={() => {
          if (!isActionBusy) setAssignmentToDelete(null);
        }}
        onConfirm={handleRemoveAssignmentConfirm}
        title="Remove Schedule Assignment?"
        description="Are you sure you want to remove this future schedule assignment? This action cannot be undone."
        details={[
          {
            label: 'Employee',
            value: assignmentToDelete
              ? `${assignmentToDelete.employeeNumber} — ${assignmentToDelete.employeeName}`
              : '',
          },
          {
            label: 'Schedule',
            value: assignmentToDelete
              ? `${assignmentToDelete.scheduleName} (v${assignmentToDelete.versionNumber})`
              : '',
          },
          { label: 'Effective From', value: assignmentToDelete?.effectiveFrom || '' },
        ]}
        confirmLabel="Remove Assignment"
        confirmVariant="danger"
        busy={isActionBusy}
      />
    </div>
  );
}
