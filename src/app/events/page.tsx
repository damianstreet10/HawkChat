"use client";

/**
 * Staff/member project picker (`/events`).
 * Debug empty enrollments, department filter, active/upcoming/previous buckets,
 * or redirect to login — data from GET `/api/events`.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { StaffPortalHeader } from "@/components/StaffPortalHeader";
import { useSession } from "@/hooks/useSession";
import { isStaffPortalRole } from "@/lib/permissions";
import type { EventTimeStatus } from "@/lib/events";
import {
  EVENT_DEPARTMENTS,
  EVENT_DEPARTMENT_LABELS,
  departmentLabel,
  departmentStyle,
  type EventDepartment,
} from "@/lib/event-departments";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  notebookCount?: number;
  starts_at?: string | null;
  ends_at?: string | null;
  timeStatus?: EventTimeStatus;
  chatOpen?: boolean;
  dateRangeLabel?: string | null;
  department?: string | null;
  created_by_name?: string | null;
  created_by_email?: string | null;
};

type DepartmentFilter = "all" | EventDepartment;

function ProjectCard({ event }: { event: EventRow }) {
  const status = event.timeStatus ?? "active";
  const statusLabel =
    status === "active"
      ? "Active"
      : status === "upcoming"
        ? "Upcoming"
        : "Previous";
  const statusClass =
    status === "active"
      ? "text-emerald-300"
      : status === "upcoming"
        ? "text-hawk-200"
        : "text-hawk-400";

  return (
    <Link
      href={`/events/${event.slug}`}
      className="hawk-card block p-5 transition hover:border-orange/50 hover:shadow-hawk-glow"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="font-display text-lg font-bold text-hawk-50">
            {event.title}
          </h3>
          <span
            className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${departmentStyle(event.department)}`}
          >
            {departmentLabel(event.department)}
          </span>
        </div>
        <span className={`text-xs font-bold uppercase tracking-widest ${statusClass}`}>
          {statusLabel}
        </span>
      </div>
      {event.description && (
        <p className="mt-2 text-sm text-hawk-300">{event.description}</p>
      )}
      {(event.created_by_name || event.created_by_email) && (
        <p className="mt-2 text-xs text-hawk-400">
          Created by{" "}
          <span className="text-hawk-200">
            {event.created_by_name || event.created_by_email}
          </span>
        </p>
      )}
      <p className="mt-2 text-xs text-hawk-400">
        {event.dateRangeLabel
          ? `${event.dateRangeLabel} · `
          : ""}
        {event.notebookCount ?? 0} notebook(s)
        {status === "past"
          ? " · Browse only"
          : status === "upcoming"
            ? " · Opens on start date"
            : " · Ask questions"}
      </p>
    </Link>
  );
}

function ProjectSection({
  title,
  subtitle,
  events,
}: {
  title: string;
  subtitle: string;
  events: EventRow[];
}) {
  if (events.length === 0) return null;
  return (
    <section className="mb-10">
      <h3 className="mb-1 text-sm font-bold uppercase tracking-widest text-orange">
        {title}
      </h3>
      <p className="mb-4 text-sm text-hawk-300">{subtitle}</p>
      <ul className="space-y-3">
        {events.map((event) => (
          <li key={event.id}>
            <ProjectCard event={event} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function EventsPickerPage() {
  const router = useRouter();
  const session = useSession();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] =
    useState<DepartmentFilter>("all");

  const isStaff =
    session.user && isStaffPortalRole(session.user.role);

  useEffect(() => {
    if (session.loading) return;
    if (!session.authenticated) {
      router.replace("/login/staff?from=/events");
      return;
    }

    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => {
        const list = data.events ?? [];
        setEvents(list);
      })
      .catch(() => setError("Could not load events."))
      .finally(() => setLoading(false));
  }, [session.loading, session.authenticated, session.user, router]);

  const filteredEvents = useMemo(() => {
    if (departmentFilter === "all") return events;
    return events.filter((event) => event.department === departmentFilter);
  }, [events, departmentFilter]);

  const { active, upcoming, previous } = useMemo(() => {
    const active: EventRow[] = [];
    const upcoming: EventRow[] = [];
    const previous: EventRow[] = [];
    for (const event of filteredEvents) {
      const status = event.timeStatus ?? "active";
      if (status === "past") previous.push(event);
      else if (status === "upcoming") upcoming.push(event);
      else active.push(event);
    }
    return { active, upcoming, previous };
  }, [filteredEvents]);

  return (
    <div className="hawk-page min-h-screen">
      <StaffPortalHeader title="All projects" />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h2 className="font-display mb-2 text-2xl font-bold uppercase tracking-wide text-hawk-50">
          Your projects
        </h2>
        <p className="mb-6 text-sm text-hawk-300">
          {isStaff
            ? "Admins and monitors see every project. Active projects accept questions; previous ones are browse-only."
            : "Active projects let you ask questions. Previous enrollments stay available to browse."}
        </p>

        {/* --- Department filter --- */}
        {!loading && !error && events.length > 0 && (
          <div className="mb-8">
            <label className="mb-1 block text-sm text-hawk-200">
              Filter by department
            </label>
            <select
              value={departmentFilter}
              onChange={(e) =>
                setDepartmentFilter(e.target.value as DepartmentFilter)
              }
              className="hawk-input w-full max-w-xs px-3 py-2 text-sm"
            >
              <option value="all">All departments</option>
              {EVENT_DEPARTMENTS.map((id) => (
                <option key={id} value={id}>
                  {EVENT_DEPARTMENT_LABELS[id]}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <p className="text-hawk-400">Loading…</p>
        ) : error ? (
          <p className="text-orange-light">{error}</p>
        ) : events.length === 0 ? (
          <div className="hawk-card-muted px-6 py-16 text-center">
            <p className="font-display text-lg font-bold uppercase tracking-wide text-hawk-50">
              Currently not enrolled in any projects
            </p>
            <p className="mt-3 text-sm text-hawk-300">
              {isStaff
                ? "No projects exist yet. Create one from Manage events."
                : "When an admin enrolls you in a project, it will show up here."}
            </p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="hawk-card-muted px-6 py-12 text-center">
            <p className="text-sm text-hawk-300">
              No projects in{" "}
              {departmentFilter === "all"
                ? "this filter"
                : EVENT_DEPARTMENT_LABELS[departmentFilter]}
              .
            </p>
          </div>
        ) : (
          <>
            {/* --- Project lists by time status --- */}
            <ProjectSection
              title="Active"
              subtitle="Ask questions in these notebooks."
              events={active}
            />
            <ProjectSection
              title="Upcoming"
              subtitle="Enrolled — chat opens on the start date."
              events={upcoming}
            />
            <ProjectSection
              title="Previous"
              subtitle="Past enrollments — browse notebooks and history, no new questions."
              events={previous}
            />
          </>
        )}
      </main>
    </div>
  );
}
