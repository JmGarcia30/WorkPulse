'use client';

import { useState } from 'react';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { RequirementType } from '@prisma/client';

export interface StructuredRequirementInput {
  id?: string;
  name: string;
  type: RequirementType;
  description: string;
  isRequired: boolean;
}

interface RequirementsBuilderProps {
  initialRequirements?: StructuredRequirementInput[];
}

export function RequirementsBuilder({ initialRequirements = [] }: RequirementsBuilderProps) {
  const [reqs, setReqs] = useState<StructuredRequirementInput[]>(initialRequirements);
  const [name, setName] = useState('');
  const [type, setType] = useState<RequirementType>(RequirementType.SKILL);
  const [description, setDescription] = useState('');
  const [isRequired, setIsRequired] = useState(true);

  const addRequirement = () => {
    if (!name.trim()) return;
    setReqs([
      ...reqs,
      {
        name: name.trim(),
        type,
        description: description.trim(),
        isRequired,
      },
    ]);
    setName('');
    setDescription('');
    setIsRequired(true);
  };

  const removeRequirement = (index: number) => {
    setReqs(reqs.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
      {/* Hidden input storing stringified JSON for server action */}
      <input type="hidden" name="requirementsJson" value={JSON.stringify(reqs)} />

      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Structured Job Requirements
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Define discrete criteria (Skills, Education, Certifications) to establish qualification benchmarks.
        </p>
      </div>

      {/* Requirement List */}
      <div className="space-y-2">
        {reqs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700">
            No structured requirements added yet. Use the form below to add skills or qualifications.
          </div>
        ) : (
          reqs.map((req, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {req.name}
                    </span>
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                      {req.type}
                    </span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                        req.isRequired
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {req.isRequired ? 'Required' : 'Preferred'}
                    </span>
                  </div>
                  {req.description && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {req.description}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeRequirement(idx)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
                title="Remove requirement"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add New Requirement Form */}
      <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Requirement Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Master’s Degree in Physics"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as RequirementType)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value={RequirementType.SKILL}>SKILL</option>
              <option value={RequirementType.EDUCATION}>EDUCATION</option>
              <option value={RequirementType.EXPERIENCE}>EXPERIENCE</option>
              <option value={RequirementType.CERTIFICATION}>CERTIFICATION</option>
              <option value={RequirementType.OTHER}>OTHER</option>
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4 items-end">
          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional specification or guidelines"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div className="flex items-center gap-2 pb-1">
            <input
              type="checkbox"
              id="reqMandatory"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700"
            />
            <label htmlFor="reqMandatory" className="text-xs text-slate-700 dark:text-slate-300">
              Mandatory
            </label>
          </div>
        </div>

        <button
          type="button"
          onClick={addRequirement}
          disabled={!name.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Requirement
        </button>
      </div>
    </div>
  );
}
