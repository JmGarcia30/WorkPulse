'use client';

import React from 'react';
import { Mail, Phone, Building2, MapPin, GraduationCap, Briefcase } from 'lucide-react';

interface CandidateIdentityCardProps {
  candidateName: string;
  avatarInitials: string;
  jobTitle: string;
  department: string;
  location?: string | null;
  category: 'TEACHING' | 'NON_TEACHING' | string;
  email: string;
  phone?: string | null;
}

export function CandidateIdentityCard({
  candidateName,
  avatarInitials,
  jobTitle,
  department,
  location,
  category,
  email,
  phone,
}: CandidateIdentityCardProps) {
  const isTeaching = category === 'TEACHING';

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Left Column: Avatar & Basic Information */}
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          {/* Avatar Box with Initials */}
          <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-100 font-bold text-base sm:text-lg text-slate-800 border border-slate-200/60 uppercase shadow-inner">
            {avatarInitials}
          </div>

          <div className="space-y-1.5 min-w-0">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                {candidateName}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-600 truncate">
                {jobTitle}
              </p>
            </div>

            {/* Department, Location & Category Tags */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-200/60 px-2 py-0.5 font-medium text-slate-600">
                <Building2 className="h-3 w-3 text-slate-400" />
                <span>{department}</span>
              </span>

              {location && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-200/60 px-2 py-0.5 font-medium text-slate-600">
                  <MapPin className="h-3 w-3 text-slate-400" />
                  <span>{location}</span>
                </span>
              )}

              <span
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-medium ${
                  isTeaching
                    ? 'bg-indigo-50 border border-indigo-200/60 text-indigo-700'
                    : 'bg-slate-100 border border-slate-200/80 text-slate-700'
                }`}
              >
                {isTeaching ? (
                  <>
                    <GraduationCap className="h-3 w-3 text-indigo-500" />
                    <span>Faculty / Teaching</span>
                  </>
                ) : (
                  <>
                    <Briefcase className="h-3 w-3 text-slate-500" />
                    <span>Non-Teaching Personnel</span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Contact Details & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center lg:flex-col lg:items-end gap-2.5 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
          <div className="flex flex-col sm:items-start lg:items-end gap-1 text-xs">
            {/* Email link */}
            <a
              href={`mailto:${email}`}
              className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium transition"
            >
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              <span>{email}</span>
            </a>

            {/* Phone link */}
            {phone && (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium transition"
              >
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                <span>{phone}</span>
              </a>
            )}
          </div>

          {/* Quick Communication Action Buttons */}
          <div className="flex items-center gap-1.5 pt-1">
            <a
              href={`mailto:${email}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition shadow-xs"
              title={`Send email to ${email}`}
              aria-label={`Send email to ${email}`}
            >
              <Mail className="h-3.5 w-3.5" />
            </a>
            {phone && (
              <a
                href={`tel:${phone}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition shadow-xs"
                title={`Call ${phone}`}
                aria-label={`Call ${phone}`}
              >
                <Phone className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
