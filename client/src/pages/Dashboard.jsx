import React, {
  useState,
  useEffect,
  useMemo,
  memo,
  useRef,
  useCallback,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { fetchTicketStats } from "../api/axiosInstance";
import { useTickets } from "../context/TicketContext";
import { useAuth } from "../context/AuthContext";
import api, { fetchActiveTimeStats, fetchMonthOnMonthReport } from "../services/api";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Ticket,
  AlertTriangle,
  UserX,
  Clock,
  ArrowRight,
  Loader2,
  Download,
  Layers,
  CheckCircle2,
  ShieldAlert,
  FolderOpen,
  CheckCircle,
} from "lucide-react";

/**
 * ⚡ Optimized Table Row Component wrapped in React.memo
 * Prevents unnecessary re-renders when parent states change or users type in search filters.
 */
const TableRowItem = memo(({ t, isUserManagerOrAdmin, operators, handleAssignToMe, handleManagerAssign, formatDate }) => {
  const navigate = useNavigate();
  const mongoId = t._id || t.id;
  const isResolvedState = t.isResolved || ["closed", "resolved", "completed", "done"].includes((t.status || "").toLowerCase());
  const isRestricted = !isUserManagerOrAdmin;

  return (
    <tr
      onClick={() => navigate(`/tickets/${t.ticketId}`)}
      className="hover:bg-slate-50/85 cursor-pointer transition-colors group"
    >
      <td className="py-4 px-4 font-semibold text-blue-600 group-hover:text-blue-700 whitespace-nowrap">
        {t.ticketId}
      </td>
      <td className="py-4 px-4 font-medium text-slate-700 whitespace-nowrap">
        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-[11px]">
          {t.entrySource}
        </span>
      </td>
      <td className="py-4 px-4 text-slate-500 whitespace-nowrap">
        {formatDate(t.createdAt)}
      </td>
      <td className="py-4 px-4 font-medium text-slate-900 max-w-[180px] truncate" title={t.title}>
        {t.title}
      </td>
      <td className="py-4 px-4 text-slate-500 whitespace-nowrap">
        {t.category || "—"}
      </td>
      <td className="py-4 px-4 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] ${
            t.priority === "Critical"
              ? "bg-rose-50 text-rose-700 border border-rose-200"
              : t.priority === "High"
                ? "bg-orange-50 text-orange-700 border border-orange-200"
                : t.priority === "Medium"
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-slate-100 text-slate-700 border border-slate-200"
          }`}
        >
          {t.priority}
        </span>
      </td>
      <td className="py-4 px-4 font-medium text-slate-800 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        {t.isAssigned ? (
          <span className="text-slate-900 font-medium">{t.assigneeName}</span>
        ) : !isUserManagerOrAdmin ? (
          <button
            onClick={(e) => handleAssignToMe(e, mongoId)}
            className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[11px] px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer"
          >
            Assign to Me
          </button>
        ) : (
          <select
            value={t.assignee || t.assignedTo || ""}
            disabled={isRestricted || isResolvedState}
            onChange={(e) => {
              e.stopPropagation();
              handleManagerAssign(mongoId, e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full py-1 px-2 border border-slate-200 rounded-md text-[11px] bg-white text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
          >
            <option value="" disabled>Select</option>
            {operators.map((u) => (
              <option key={u._id || u.id} value={u.name || u.fullName || u.username}>
                {u.name || u.fullName || u.username} ({u.role || u.userType || "Operator"})
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="py-4 px-4 whitespace-nowrap">
        {t.primaryStartFormatted ? (
          <div className="inline-flex flex-col bg-slate-50/80 border border-slate-200/80 rounded-xl px-3 py-1.5 text-[11px]">
            <span className="text-slate-500 font-medium">Start: {t.primaryStartFormatted}</span>
            <span className="text-slate-500 font-medium">End: {t.primaryEndFormatted}</span>
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="py-4 px-4 whitespace-nowrap">
        {t.isAssigned ? (
          <span className="inline-flex items-center px-3 py-1 rounded-xl bg-slate-100/80 border border-slate-200 text-slate-700 font-medium text-[11px]">
            {t.assignmentTimeFormatted}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="py-4 px-4 whitespace-nowrap">
        {t.isSubAssigned ? (
          <span className="font-medium text-purple-700">{t.subAssignmentName}</span>
        ) : (
          <span className="text-slate-400 italic">None</span>
        )}
      </td>
      <td className="py-4 px-4 whitespace-nowrap">
        {t.isSubAssigned && t.subStartFormatted ? (
          <div className="inline-flex flex-col bg-purple-50/40 border border-purple-100 rounded-xl px-3 py-1.5 text-[11px]">
            <span className="text-purple-900 font-medium">Start: {t.subStartFormatted}</span>
            <span className="text-purple-700 font-medium">End: {t.subEndFormatted}</span>
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="py-4 px-4 whitespace-nowrap">
        {t.isSubAssigned ? (
          <span className="inline-flex items-center px-3 py-1 rounded-xl bg-purple-50/60 border border-purple-100 text-purple-700 font-medium text-[11px]">
            {t.subAssignmentTimeFormatted}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="py-4 px-4 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-xl font-medium text-[11px] border ${
            t.slaStatus === "Breached"
              ? "bg-rose-50 text-rose-700 border-rose-200"
              : t.slaStatus === "At Risk"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
        >
          {t.slaStatus}
        </span>
      </td>
      <td className="py-4 px-4 whitespace-nowrap">
        <div className="flex flex-col gap-1">
          <span
            className={`px-3 py-1 font-bold uppercase rounded-xl text-[10px] tracking-wider inline-flex items-center justify-center w-max ${
              isResolvedState ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
            }`}
          >
            {t.status || "Open"}
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            Total: {t.finalResolutionTimeFormatted}
          </span>
        </div>
      </td>
    </tr>
  );
});
TableRowItem.displayName = "TableRowItem";

/**
 * Normalization Engine: Robust source/generator field extraction mapping.
 */
const normalizeTicket = (t, now) => {
  let rawAssignee =
    t.assignee ||
    t.assignedTo ||
    t.assigned_to ||
    t.assignedUser ||
    "Unassigned";
  if (typeof rawAssignee === "object" && rawAssignee !== null) {
    rawAssignee =
      rawAssignee.name ||
      rawAssignee.fullName ||
      rawAssignee.email ||
      "Unassigned";
  }

  let rawSubAssignee =
    t.subAssignment ||
    t.sub_assignment ||
    t.subAssignedTo ||
    t.sub_assigned_to ||
    t.subAssignee ||
    null;
  if (typeof rawSubAssignee === "object" && rawSubAssignee !== null) {
    rawSubAssignee =
      rawSubAssignee.name ||
      rawSubAssignee.fullName ||
      rawSubAssignee.email ||
      null;
  }

  const status = (t.status || t.ticketStatus || t.state || "open")
    .toString()
    .toLowerCase();
  const isResolved = ["closed", "resolved", "completed", "done"].includes(
    status,
  );

  let sla = t.slaStatus || t.sla_status || t.sla || "On Track";
  if (typeof sla === "string" && !t.slaDeadline) {
    const lowerSla = sla.toLowerCase();
    if (lowerSla.includes("breach")) sla = "Breached";
    else if (
      lowerSla.includes("due") ||
      lowerSla.includes("warn") ||
      lowerSla.includes("risk")
    )
      sla = "At Risk";
    else sla = "On Track";
  }

  const deadlineRaw =
    t.slaDeadline || t.sla_deadline || t.dueDate || t.due_date;
  if (deadlineRaw) {
    const deadline = new Date(deadlineRaw);
    if (!isNaN(deadline.getTime())) {
      const evaluationTime = isResolved
        ? new Date(t.resolvedAt || t.resolved_at || t.closedAt || now).getTime()
        : now.getTime();
      const diffMinutes = (deadline.getTime() - evaluationTime) / (1000 * 60);

      if (diffMinutes < 0) {
        sla = "Breached";
      } else if (diffMinutes <= 30 && !isResolved) {
        sla = "At Risk";
      } else if (!isResolved) {
        sla = "On Track";
      }
    }
  }

  const rawPriorityStr = (t.priority || t.priorityLevel || t.severity || "Low")
    .toString()
    .toLowerCase();
  let priority = "Low";
  if (rawPriorityStr.includes("crit") || rawPriorityStr.includes("p1"))
    priority = "Critical";
  else if (rawPriorityStr.includes("high") || rawPriorityStr.includes("p2"))
    priority = "High";
  else if (rawPriorityStr.includes("med") || rawPriorityStr.includes("p3"))
    priority = "Medium";

  const rawCategoryStr = (
    t.category ||
    t.type ||
    t.ticketType ||
    t.kind ||
    "General"
  ).toString();

  let rawSourceStr = "";
  const candidateSources = [
    t.generator,
    t.source,
    t.origin,
    t.channel,
    t.createdByRole,
    t.creator,
    t.created_by,
    t.type,
    t.role,
    t.department,
    t.sourceChannel,
  ];

  for (const candidate of candidateSources) {
    if (!candidate) continue;
    if (
      typeof candidate === "string" &&
      candidate.trim() !== "" &&
      candidate !== "undefined" &&
      candidate !== "null"
    ) {
      rawSourceStr = candidate.trim();
      break;
    }
    if (typeof candidate === "object") {
      const subVal =
        candidate.name ||
        candidate.title ||
        candidate.role ||
        candidate.type ||
        candidate.label ||
        candidate.username;
      if (subVal && typeof subVal === "string" && subVal.trim() !== "") {
        rawSourceStr = subVal.trim();
        break;
      }
    }
  }

  if (!rawSourceStr && t.metadata) {
    const metaObj = t.metadata;
    const metaSource =
      metaObj.source || metaObj.generator || metaObj.channel || metaObj.origin;
    if (metaSource) rawSourceStr = String(metaSource).trim();
  }

  if (!rawSourceStr) {
    rawSourceStr = t.companyId ? "Company Portal" : "Direct System";
  }

  const assigneeName =
    typeof rawAssignee === "string" ? rawAssignee : "Unassigned";
  const isAssigned =
    assigneeName.toLowerCase() !== "unassigned" && assigneeName !== "";

  const subAssignmentName =
    typeof rawSubAssignee === "string" ? rawSubAssignee.trim() : "";
  const isSubAssigned =
    subAssignmentName !== "" &&
    subAssignmentName.toLowerCase() !== "unassigned";

  const createdAtTime = new Date(
    t.createdAt || t.created_at || t.timestamp || now,
  ).getTime();
  const assignedAtRaw = t.assignedAt || t.assigned_at || t.assignmentTime;
  const assignedAtTime = assignedAtRaw
    ? new Date(assignedAtRaw).getTime()
    : createdAtTime;

  const subAssignedAtRaw =
    t.subAssignmentAt ||
    t.sub_assigned_at ||
    t.subAssignedAt ||
    t.sub_assignment_at ||
    (isSubAssigned ? t.updatedAt || t.createdAt : null);
  const subAssignedAtTime = subAssignedAtRaw
    ? new Date(subAssignedAtRaw).getTime()
    : null;

  const resolvedAtRaw = t.resolvedAt || t.resolved_at || t.closedAt;
  const resolvedAtTime = isResolved
    ? resolvedAtRaw
      ? new Date(resolvedAtRaw).getTime()
      : now.getTime()
    : null;

  const currentOrResolveTime = isResolved ? resolvedAtTime : now.getTime();

  let primaryAssignmentMs = 0;
  if (isAssigned) {
    const primaryEndTime =
      isSubAssigned && subAssignedAtTime
        ? subAssignedAtTime
        : currentOrResolveTime;
    primaryAssignmentMs = Math.max(0, primaryEndTime - assignedAtTime);
  }

  let subAssignmentTimeMs = 0;
  if (isSubAssigned && subAssignedAtTime) {
    subAssignmentTimeMs = Math.max(0, currentOrResolveTime - subAssignedAtTime);
  }

  const finalResolutionTimeMs = isResolved
    ? Math.max(0, resolvedAtTime - createdAtTime)
    : null;

  const formatDateShort = (dStr) => {
    if (!dStr) return null;
    const d = new Date(dStr);
    return isNaN(d.getTime())
      ? null
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
          ", " +
          d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const primaryStartFormatted = isAssigned
    ? formatDateShort(assignedAtRaw || t.createdAt)
    : null;
  const primaryEndFormatted = isAssigned
    ? isSubAssigned && subAssignedAtRaw
      ? formatDateShort(subAssignedAtRaw)
      : isResolved
        ? formatDateShort(resolvedAtRaw)
        : "Present"
    : null;

  const subStartFormatted = isSubAssigned
    ? formatDateShort(subAssignedAtRaw)
    : null;
  const subEndFormatted = isSubAssigned
    ? isResolved
      ? formatDateShort(resolvedAtRaw)
      : "Present"
    : null;

  const formatDuration = (ms) => {
    if (ms === null || ms === undefined || isNaN(ms)) return "Null";
    if (ms < 60000) return "0h 1m";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  return {
    ...t,
    id: t._id || t.id || t.ticketId || t.code || "N/A",
    ticketId: t.ticketId || t.id || t._id || t.code || "N/A",
    title: t.title || t.subject || t.name || t.description || "Untitled Ticket",
    entrySource: rawSourceStr,
    assigneeName,
    subAssignmentName: isSubAssigned ? subAssignmentName : "Null",
    subAssignmentAt: subAssignedAtRaw,
    status: t.status || "Open",
    createdAt: t.createdAt || t.created_at || new Date().toISOString(),
    priority,
    category: rawCategoryStr,
    slaStatus: sla,
    isResolved,
    isSubAssigned,
    isAssigned,
    primaryStartFormatted,
    primaryEndFormatted,
    assignmentTimeFormatted: isAssigned
      ? formatDuration(primaryAssignmentMs)
      : "Null",
    subStartFormatted,
    subEndFormatted,
    subAssignmentTimeFormatted: isSubAssigned
      ? formatDuration(subAssignmentTimeMs)
      : "Null",
    finalResolutionTimeFormatted: isResolved
      ? formatDuration(finalResolutionTimeMs)
      : "Pending",
  };
};

/**
 * Custom Styled Tooltip Component for Charts
 */
const CustomTooltip = memo(({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-xl shadow-xl border border-slate-700/65 animate-in fade-in zoom-in-95 duration-150">
        {label && <p className="font-bold text-slate-300 mb-1">{label}</p>}
        {payload.map((entry, index) => (
          <div key={`tooltip-${index}`} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color || entry.fill }}
            />
            <span className="text-slate-300 capitalize">
              {entry.name || entry.dataKey}:
            </span>
            <span className="font-bold text-white">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
});
CustomTooltip.displayName = "CustomTooltip";

/**
 * List-based Card for Creators & Sources with Month Filter support
 */
const GeneratorListCard = memo(
  ({ title, data, totalLabel = "total", theme = "emerald", isLoading, selectedMonth, onMonthChange }) => {
    const totalValue = useMemo(() => {
      return data.reduce((acc, curr) => {
        if (curr.rawPrimary !== undefined) {
          return acc + (Number(curr.rawPrimary) || 0) + (Number(curr.rawSub) || 0);
        }
        return acc + (Number(curr.count) || 0);
      }, 0);
    }, [data]);

    const themeStyles = {
      emerald: {
        iconColor: "text-emerald-600",
        badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-100",
        itemBadgeBg: "bg-emerald-50 text-emerald-700 border-emerald-100/60",
      },
      blue: {
        iconColor: "text-blue-600",
        badgeBg: "bg-blue-50 text-blue-700 border-blue-100",
        itemBadgeBg: "bg-blue-50 text-blue-700 border-blue-100/60",
      },
      purple: {
        iconColor: "text-purple-600",
        badgeBg: "bg-purple-50 text-purple-700 border-purple-100",
        itemBadgeBg: "bg-purple-50 text-purple-700 border-purple-100/60",
      },
    };

    const currentTheme = themeStyles[theme] || themeStyles.emerald;

    if (isLoading) {
      return (
        <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs flex flex-col justify-between h-72 animate-pulse">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="h-4 bg-slate-200 rounded w-36" />
              <div className="h-6 bg-slate-200 rounded-lg w-20" />
            </div>
          </div>
          <div className="my-2 flex-1 space-y-3 py-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-3.5 bg-slate-200 rounded w-28" />
                <div className="h-5 bg-slate-200 rounded-lg w-14" />
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-slate-100">
            <div className="h-3 bg-slate-100 rounded w-48" />
          </div>
        </div>
      );
    }

    return (
      <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between h-72">
        <div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div className="flex items-center gap-2">
              <Layers size={16} className={currentTheme.iconColor} />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {title}
              </h4>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              {onMonthChange && (
                <select
                  value={selectedMonth}
                  onChange={(e) => onMonthChange(e.target.value)}
                  className="text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none cursor-pointer"
                >
                  {[
                    "All Months",
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                  ].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${currentTheme.badgeBg}`}
              >
                Total: {totalValue}
              </span>
            </div>
          </div>
        </div>

        <div className="my-2 flex-1 overflow-y-auto space-y-2 pr-1">
          {data.length > 0 ? (
            data.map((item, idx) => (
              <div
                key={`gen-row-${idx}`}
                className="flex items-center justify-between py-1 transition-all"
              >
                <span className="text-sm font-medium text-slate-700 truncate pr-2">
                  {item.name}
                </span>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-lg border whitespace-nowrap ${currentTheme.itemBadgeBg}`}
                >
                  {item.count} {totalLabel}
                </span>
              </div>
            ))
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
              No metrics available for {selectedMonth === "All Months" ? "this period" : selectedMonth}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-slate-100">
          <p className="text-[11px] text-slate-400 italic">
            Breakdown tracked across roles and operational parameters.
          </p>
        </div>
      </div>
    );
  },
);
GeneratorListCard.displayName = "GeneratorListCard";

export const Dashboard = ({ tickets: propTickets, onOpenCreateTicket }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    tickets: contextTickets,
    isLoading: contextLoading,
    fetchTickets,
    updateTicket,
  } = useTickets();
  const { user, isAdmin, isManager, role } = useAuth();

  const tickets =
    propTickets && propTickets.length > 0 ? propTickets : contextTickets;
  
  const [isDataLoading, setIsDataLoading] = useState(!tickets || tickets.length === 0);

  const [backendStats, setBackendStats] = useState(null);
  const [activeTimes, setActiveTimes] = useState([]);
  const [monthOnMonth, setMonthOnMonth] = useState([]);
  const [now, setNow] = useState(() => new Date());

  const [velocityDays, setVelocityDays] = useState(7);
  const [selectedTab, setSelectedTab] = useState("all");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [operators, setOperators] = useState([]);
  
  const currentYearStr = new Date().getFullYear().toString();
  const currentMonthName = new Date().toLocaleString("en-US", { month: "long" });
  const [selectedMomMonth, setSelectedMomMonth] = useState(currentMonthName);

  // Dedicated month filter states for the three specific boxes
  const [generatorMonth, setGeneratorMonth] = useState("All Months");
  const [operatorWorkloadMonth, setOperatorWorkloadMonth] = useState("All Months");
  const [operatorResolvedMonth, setOperatorResolvedMonth] = useState("All Months");

  // Dedicated state for Excel report month filter
  const [excelExportMonth, setExcelExportMonth] = useState(currentMonthName);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const userRoleRaw = role || user?.role || user?.userType || user?.type || "";

  const currentRole = useMemo(() => {
    return typeof userRoleRaw === "string"
      ? userRoleRaw.replace(/\s+/g, "_").toLowerCase()
      : "";
  }, [userRoleRaw]);

  const isUserManagerOrAdmin = useMemo(() => {
    return (
      isAdmin ||
      isManager ||
      currentRole.includes("admin") ||
      currentRole.includes("manager")
    );
  }, [isAdmin, isManager, currentRole]);

  const queue = searchParams.get("queue") || "all-work";

  const hasFetchedTicketsRef = useRef(false);
  const hasFetchedStatsRef = useRef(false);

  useEffect(() => {
    if (!propTickets && fetchTickets && !hasFetchedTicketsRef.current) {
      hasFetchedTicketsRef.current = true;
      fetchTickets(queue);
    }
  }, [queue, fetchTickets, propTickets]);

  useEffect(() => {
    let isMounted = true;

    if (tickets && tickets.length > 0) {
      setIsDataLoading(false);
    }

    const getStatsData = async () => {
      if (hasFetchedStatsRef.current) return;
      hasFetchedStatsRef.current = true;

      try {
        const statsPromise = fetchTicketStats().then((data) => {
          if (data && isMounted) setBackendStats(data);
        }).catch((err) => console.error("Stats error:", err));

        const activeResPromise = api.get('/reports/active-time').then((activeRes) => {
          if (activeRes.data && isMounted) setActiveTimes(activeRes.data);
        }).catch((err) => console.error("Active time error:", err));

        const momResPromise = api.get('/reports/month-on-month').then((momRes) => {
          if (momRes.data && isMounted) setMonthOnMonth(momRes.data);
        }).catch((err) => console.error("MoM error:", err));

        await Promise.allSettled([statsPromise, activeResPromise, momResPromise]);
      } catch (err) {
        console.error("Error fetching dashboard analytics:", err);
      } finally {
        if (isMounted) {
          setIsDataLoading(false);
        }
      }
    };

    getStatsData();

    const safetyTimer = setTimeout(() => {
      if (isMounted) setIsDataLoading(false);
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, [tickets]);

  useEffect(() => {
    const fetchOperatorsList = async () => {
      try {
        const response = await api.get("/users");
        const allUsers = response.data || [];
        
        // Filter out Transporter, Shipper, Ops, and Sales personnel as requested
        const filteredOps = allUsers.filter((u) => {
          const r = (u.role || u.userType || "")
            .replace(/\s+/g, "_")
            .toLowerCase();
          const name = (u.name || u.fullName || u.username || "").toLowerCase();

          const isShipper = r.includes("shipper") || name.includes("shipper");
          const isSales = r.includes("sales") || name.includes("sales");
          const isTransporter = r.includes("transporter") || name.includes("transporter");
          const isOps = r.includes("ops") || name.includes("ops") || r.includes("operation");
          const isSelectPlaceholder = name === "select" || name === "--select--";

          return !isShipper && !isSales && !isTransporter && !isOps && !isSelectPlaceholder;
        });

        setOperators(filteredOps);
      } catch (err) {
        console.error("Failed to fetch operators list", err);
      }
    };
    if (isUserManagerOrAdmin) {
      fetchOperatorsList();
    }
  }, [isUserManagerOrAdmin]);

  const handleAssignToMe = useCallback(
    async (e, mongoId) => {
      e.stopPropagation();
      try {
        const currentUserName =
          user?.name || user?.username || user?.fullName || "Operator";
        await updateTicket(mongoId, { assignee: currentUserName });
        if (fetchTickets) fetchTickets(queue, true);
      } catch (err) {
        console.error("Failed to assign ticket to self", err);
        alert(err.response?.data?.message || "Failed to assign ticket");
      }
    },
    [user, updateTicket, fetchTickets, queue],
  );

  const handleManagerAssign = useCallback(
    async (mongoId, selectedOperatorName) => {
      if (!selectedOperatorName || selectedOperatorName === "Unassigned") return;
      try {
        await updateTicket(mongoId, { assignee: selectedOperatorName });
        if (fetchTickets) fetchTickets(queue, true);
      } catch (err) {
        console.error("Failed to assign ticket", err);
        alert(err.response?.data?.message || "Failed to assign ticket");
      }
    },
    [updateTicket, fetchTickets, queue],
  );

  const normalizedTickets = useMemo(
    () =>
      (Array.isArray(tickets) ? tickets : []).map((t) =>
        normalizeTicket(t, now),
      ),
    [tickets, now],
  );

  // Month filter helper for boxes
  const filterTicketsByMonth = useCallback((ticketList, monthName) => {
    if (!monthName || monthName === "All Months") return ticketList;
    const monthsMap = {
      January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
      July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
    };
    const targetMonthIndex = monthsMap[monthName];
    const currentYear = new Date().getFullYear();
    return ticketList.filter((t) => {
      if (!t.createdAt) return false;
      const d = new Date(t.createdAt);
      return !isNaN(d.getTime()) && d.getMonth() === targetMonthIndex && d.getFullYear() === currentYear;
    });
  }, []);

  const generatorTicketsFiltered = useMemo(() => filterTicketsByMonth(normalizedTickets, generatorMonth), [normalizedTickets, generatorMonth, filterTicketsByMonth]);
  const operatorWorkloadTicketsFiltered = useMemo(() => filterTicketsByMonth(normalizedTickets, operatorWorkloadMonth), [normalizedTickets, operatorWorkloadMonth, filterTicketsByMonth]);
  const operatorResolvedTicketsFiltered = useMemo(() => filterTicketsByMonth(normalizedTickets, operatorResolvedMonth), [normalizedTickets, operatorResolvedMonth, filterTicketsByMonth]);

  const fullYearMonths = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const monthsList = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const dataMap = {};
    if (Array.isArray(monthOnMonth)) {
      monthOnMonth.forEach((item) => {
        const periodKey = item.period || `${item.month}, ${item.year}`;
        dataMap[periodKey] = item;
      });
    }

    return monthsList.map((mName, index) => {
      const periodStr = `${mName} ${currentYear}`;
      const monthTickets = normalizedTickets.filter((t) => {
        const d = new Date(t.createdAt);
        return !isNaN(d.getTime()) && d.getMonth() === index && d.getFullYear() === currentYear;
      });

      const resolvedCount = monthTickets.filter((t) => t.isResolved).length;
      const createdCount = monthTickets.length;
      const existingData = dataMap[periodStr] || dataMap[`${mName} ${currentYear}`];

      return {
        month: mName,
        period: periodStr,
        ticketsCreated: existingData ? existingData.ticketsCreated : createdCount,
        ticketsResolved: existingData ? existingData.ticketsResolved : resolvedCount,
      };
    });
  }, [monthOnMonth, normalizedTickets]);

  const filteredMonthData = useMemo(() => {
    return fullYearMonths.filter((row) => row.month === selectedMomMonth);
  }, [fullYearMonths, selectedMomMonth]);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return "—";
    const d = new Date(dateString);
    return isNaN(d.getTime())
      ? "Invalid"
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
          ", " +
          d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, []);

  const handleExportExcel = () => {
    const targetMonthName = excelExportMonth;
    const monthsMap = {
      January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
      July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
    };
    const targetMonthIndex = monthsMap[targetMonthName];
    const currentYear = new Date().getFullYear();

    const monthFilteredTickets = normalizedTickets.filter((t) => {
      if (!t.createdAt) return false;
      const ticketDate = new Date(t.createdAt);
      if (isNaN(ticketDate.getTime())) return false;
      return ticketDate.getMonth() === targetMonthIndex && ticketDate.getFullYear() === currentYear;
    });

    if (monthFilteredTickets.length === 0) {
      alert(`No ticket data found to export for ${targetMonthName} ${currentYear}.`);
      return;
    }

    const headers = [
      "Ticket ID",
      "Source",
      "Created At",
      "Title",
      "Category",
      "Priority",
      "Primary Assignee",
      "Primary Assignment Timeline",
      "Primary Duration",
      "Sub-Assignee",
      "Sub-Assignment Timeline",
      "Sub-Assignee Duration",
      "SLA Health",
      "Status & Total Resolution",
    ];

    const csvRows = monthFilteredTickets.map((t) => {
      const createdAtFormatted = t.createdAt
        ? new Date(t.createdAt).toLocaleString()
        : "";

      return [
        `"${(t.ticketId || "").toString().replace(/"/g, '""')}"`,
        `"${(t.entrySource || "").replace(/"/g, '""')}"`,
        `"${createdAtFormatted}"`,
        `"${(t.title || "").replace(/"/g, '""')}"`,
        `"${(t.category || "").replace(/"/g, '""')}"`,
        `"${(t.priority || "").replace(/"/g, '""')}"`,
        `"${(t.assigneeName || "").replace(/"/g, '""')}"`,
        `"${t.primaryStartFormatted ? `Start: ${t.primaryStartFormatted} End: ${t.primaryEndFormatted}` : "Null"}"`,
        `"${t.assignmentTimeFormatted || "Null"}"`,
        `"${(t.subAssignmentName || "").replace(/"/g, '""')}"`,
        `"${t.subStartFormatted ? `Start: ${t.subStartFormatted} End: ${t.subEndFormatted}` : "Null"}"`,
        `"${t.subAssignmentTimeFormatted || "Null"}"`,
        `"${(t.slaStatus || "").replace(/"/g, '""')}"`,
        `"${(t.status || "").replace(/"/g, '""')} (Total: ${t.finalResolutionTimeFormatted})"`,
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `tickets_report_${targetMonthName.toLowerCase()}_${currentYear}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = useMemo(() => {
    let priorityMap = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    let priorityResolvedMap = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    let slaHealthMap = { "On Track": 0, "At Risk": 0, Breached: 0 };

    let assignedCount = 0;
    let unassignedCount = 0;
    let closedCount = 0;
    let openCount = 0;

    normalizedTickets.forEach((t) => {
      const isClosed =
        t.isResolved ||
        ["closed", "resolved", "completed", "done"].includes(
          t.status.toLowerCase(),
        );

      if (isClosed) {
        closedCount++;
      } else {
        openCount++;
      }

      if (t.isAssigned) {
        assignedCount++;
      } else {
        unassignedCount++;
      }

      const prio = t.priority || "Low";
      if (priorityMap[prio] !== undefined) {
        priorityMap[prio]++;
        if (isClosed) priorityResolvedMap[prio]++;
      }

      const sla = t.slaStatus || "On Track";
      slaHealthMap[sla] = (slaHealthMap[sla] || 0) + 1;
    });

    return {
      total: normalizedTickets.length,
      assigned: assignedCount,
      unassigned: unassignedCount,
      closed: closedCount,
      open: openCount,
      slaRisk: (slaHealthMap["Breached"] || 0) + (slaHealthMap["At Risk"] || 0),
      byPriority: priorityMap,
      byPriorityResolved: priorityResolvedMap,
      slaHealth: slaHealthMap,
    };
  }, [normalizedTickets]);

  const operatorRoleMap = useMemo(() => {
    const map = {};
    operators.forEach((op) => {
      const opName = op.name || op.fullName || op.username;
      const opRole = op.role || op.userType || "Operator";
      if (opName) {
        map[opName.toLowerCase()] = opRole;
      }
    });
    return map;
  }, [operators]);

  const formatOperatorName = useCallback((rawName) => {
    if (!rawName || rawName === "Unassigned" || rawName === "Null" || rawName === "None") return null;
    const lowerName = rawName.toLowerCase();
    const matchedRole = operatorRoleMap[lowerName];
    if (matchedRole && !rawName.toLowerCase().includes(matchedRole.toLowerCase())) {
      return `${rawName} (${matchedRole})`;
    } else if (!rawName.includes("(")) {
      return `${rawName} (Operator)`;
    }
    return rawName;
  }, [operatorRoleMap]);

  const chartData = useMemo(() => {
    const daysCount = Math.max(1, Math.min(30, Number(velocityDays) || 7));
    const velocityDaysArr = Array.from({ length: daysCount }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (daysCount - 1 - i));
      return {
        label: d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        fullDate: d.toDateString(),
      };
    });

    const trend = velocityDaysArr.map((day) => ({
      day: day.label,
      tickets: normalizedTickets.filter((t) => {
        const d = new Date(t.createdAt);
        return !isNaN(d.getTime()) && d.toDateString() === day.fullDate;
      }).length,
    }));

    // Generator data from filtered tickets
    const generatorMap = {};
    generatorTicketsFiltered.forEach((t) => {
      const src = t.entrySource || "Direct System";
      generatorMap[src] = (generatorMap[src] || 0) + 1;
    });
    const generatorEntries = Object.entries(generatorMap)
      .map(([name, count]) => ({ name, count: Number(count) || 0 }))
      .filter((d) => d.count > 0);

    // Operator Resolved data from filtered tickets
    const operatorResolvedMap = {};
    operatorResolvedTicketsFiltered.forEach((t) => {
      const isClosed =
        t.isResolved ||
        ["closed", "resolved", "completed", "done"].includes(t.status.toLowerCase());
      if (isClosed) {
        let operatorKeyRaw = "Unassigned / Other";
        if (t.isSubAssigned && t.subAssignmentName && t.subAssignmentName !== "Null" && t.subAssignmentName !== "None") {
          operatorKeyRaw = t.subAssignmentName;
        } else if (t.isAssigned && t.assigneeName) {
          operatorKeyRaw = t.assigneeName;
        }
        let operatorKeyFormatted = formatOperatorName(operatorKeyRaw) || operatorKeyRaw;
        operatorResolvedMap[operatorKeyFormatted] = (operatorResolvedMap[operatorKeyFormatted] || 0) + 1;
      }
    });
    const operatorResolvedEntries = Object.entries(operatorResolvedMap)
      .map(([name, count]) => ({ name, count: Number(count) || 0 }))
      .filter((d) => d.count > 0);

    // Operator Workload data from filtered tickets
    const operatorAssignmentWorkloadMap = {};
    operatorWorkloadTicketsFiltered.forEach((t) => {
      if (t.isAssigned && t.assigneeName) {
        const primaryOpFormatted = formatOperatorName(t.assigneeName);
        if (primaryOpFormatted) {
          if (!operatorAssignmentWorkloadMap[primaryOpFormatted]) {
            operatorAssignmentWorkloadMap[primaryOpFormatted] = { primary: 0, subAssigned: 0 };
          }
          operatorAssignmentWorkloadMap[primaryOpFormatted].primary += 1;
        }
      }
      if (t.isSubAssigned && t.subAssignmentName) {
        const subOpFormatted = formatOperatorName(t.subAssignmentName);
        if (subOpFormatted) {
          if (!operatorAssignmentWorkloadMap[subOpFormatted]) {
            operatorAssignmentWorkloadMap[subOpFormatted] = { primary: 0, subAssigned: 0 };
          }
          operatorAssignmentWorkloadMap[subOpFormatted].subAssigned += 1;
        }
      }
    });
    const operatorWorkloadEntries = Object.entries(operatorAssignmentWorkloadMap)
      .map(([name, counts]) => ({
        name,
        count: `Assigned: ${counts.primary} | Sub-assigned: ${counts.subAssigned}`,
        rawPrimary: counts.primary,
        rawSub: counts.subAssigned,
      }))
      .filter((d) => d.rawPrimary > 0 || d.rawSub > 0);

    const totalSlaCount = Math.max(
      1,
      (stats.slaHealth["On Track"] || 0) +
        (stats.slaHealth["At Risk"] || 0) +
        (stats.slaHealth["Breached"] || 0),
    );

    const slaPieEntries = [
      {
        name: "On Track",
        value: stats.slaHealth["On Track"] || 0,
        percentage: Math.round(
          ((stats.slaHealth["On Track"] || 0) / totalSlaCount) * 100,
        ),
        color: "#10b981",
        description: "Executing within threshold",
      },
      {
        name: "At Risk",
        value: stats.slaHealth["At Risk"] || 0,
        percentage: Math.round(
          ((stats.slaHealth["At Risk"] || 0) / totalSlaCount) * 100,
        ),
        color: "#f59e0b",
        description: "Approaching target limit",
      },
      {
        name: "Breached",
        value: stats.slaHealth["Breached"] || 0,
        percentage: Math.round(
          ((stats.slaHealth["Breached"] || 0) / totalSlaCount) * 100,
        ),
        color: "#f43f5e",
        description: "Exceeded time constraint",
      },
    ].filter((d) => d.value >= 0);

    return {
      generator: generatorEntries,
      operatorResolved: operatorResolvedEntries,
      operatorWorkload: operatorWorkloadEntries,
      trend,
      slaPie: slaPieEntries,
    };
  }, [normalizedTickets, generatorTicketsFiltered, operatorResolvedTicketsFiltered, operatorWorkloadTicketsFiltered, stats, velocityDays, formatOperatorName]);

  const filteredTickets = useMemo(() => {
    return normalizedTickets.filter((t) => {
      if (!isUserManagerOrAdmin) {
        const assigneeLower = t.assigneeName.trim().toLowerCase();
        const subAssigneeLower = t.subAssignmentName.trim().toLowerCase();
        const userName = (user?.name || user?.username || user?.fullName || "")
          .trim()
          .toLowerCase();
        const userEmail = (user?.email || "").split("@")[0].toLowerCase();

        const isAssignedToThem =
          (userName && assigneeLower.includes(userName)) ||
          (subAssigneeLower &&
            userName &&
            subAssigneeLower.includes(userName)) ||
          (userEmail && assigneeLower.includes(userEmail));

        const isUnassigned = !t.isAssigned;

        if (!isAssignedToThem && !isUnassigned) return false;
      }

      const isClosed =
        t.isResolved ||
        ["closed", "resolved", "completed", "done"].includes(
          t.status.toLowerCase(),
        );
      const isAssigned = t.isAssigned;

      if (selectedTab === "open" && isClosed) return false;
      if (selectedTab === "assigned" && !isAssigned) return false;
      if (selectedTab === "closed" && !isClosed) return false;
      if (selectedTab === "unassigned" && isAssigned) return false;
      if (
        selectedTab === "sla-risk" &&
        (isClosed || (t.slaStatus !== "Breached" && t.slaStatus !== "At Risk"))
      )
        return false;

      if (
        selectedPriorityFilter !== "all" &&
        t.priority.toLowerCase() !== selectedPriorityFilter.toLowerCase()
      ) {
        return false;
      }

      let matchesQueue = true;
      if (queue === "sla-risk") {
        matchesQueue =
          t.status?.toLowerCase() === "open" &&
          (t.slaStatus === "Breached" || t.slaStatus === "At Risk");
      } else if (queue === "open") {
        matchesQueue = t.status?.toLowerCase() === "open";
      } else if (queue === "unassigned") {
        matchesQueue = !t.isAssigned;
      }

      const searchStr = searchTerm.toLowerCase();
      return (
        matchesQueue &&
        (t.title?.toLowerCase().includes(searchStr) ||
          t.ticketId?.toLowerCase().includes(searchStr))
      );
    });
  }, [
    normalizedTickets,
    selectedTab,
    selectedPriorityFilter,
    queue,
    searchTerm,
    isUserManagerOrAdmin,
    user,
  ]);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 font-sans text-slate-800 p-3 sm:p-6 overflow-x-hidden animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Operational Dashboard
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time ticketing lifecycle, creator tracking, operator resolution metrics, and SLA health
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {onOpenCreateTicket && (
            <button
              onClick={onOpenCreateTicket}
              className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer justify-center flex-1 sm:flex-none"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              Add Ticket
            </button>
          )}

          {/* Month Filter Selector for Excel Export */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs flex-1 sm:flex-none">
            <label htmlFor="excel-month-filter" className="text-xs font-medium text-slate-500 whitespace-nowrap">
              Export Month:
            </label>
            <select
              id="excel-month-filter"
              value={excelExportMonth}
              onChange={(e) => setExcelExportMonth(e.target.value)}
              className="text-xs font-bold bg-transparent text-slate-800 focus:outline-none cursor-pointer w-full"
            >
              {[
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
              ].map((m) => (
                <option key={`export-${m}`} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer justify-center w-full sm:w-auto"
            title={`Export data for ${excelExportMonth}`}
          >
            <Download size={16} /> Export {excelExportMonth} to Excel
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Tickets", val: stats.total, icon: Ticket, tab: "all" },
          { label: "Open", val: stats.open, icon: FolderOpen, tab: "open" },
          {
            label: "Resolved",
            val: stats.closed,
            icon: CheckCircle,
            tab: "closed",
          },
          {
            label: "Unassigned",
            val: stats.unassigned,
            icon: UserX,
            tab: "unassigned",
          },
          {
            label: "Assigned",
            val: stats.assigned,
            icon: CheckCircle2,
            tab: "assigned",
          },
          {
            label: "SLA Risks",
            val: stats.slaRisk,
            icon: AlertTriangle,
            tab: "sla-risk",
          },
        ].map((item) => (
          <div
            key={item.label}
            onClick={() => setSelectedTab(item.tab)}
            className={`p-3 sm:p-4 bg-white border rounded-2xl flex items-center justify-between shadow-xs hover:shadow-md transition-all cursor-pointer ${
              selectedTab === item.tab
                ? "border-blue-500 ring-2 ring-blue-100"
                : "border-slate-200/80"
            }`}
          >
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {item.label}
              </p>
              {isDataLoading ? (
                <div className="h-6 w-8 bg-slate-200 rounded animate-pulse mt-1" />
              ) : (
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
                  {item.val}
                </h3>
              )}
            </div>
            <div
              className={`p-2 sm:p-2.5 rounded-xl transition-all ${selectedTab === item.tab ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-600"}`}
            >
              <item.icon size={18} />
            </div>
          </div>
        ))}
      </div>

      {/* Widgets Grid with Swapped Positions & Month Filters Added */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GeneratorListCard
          title="TICKETS CREATED BY ROLE / SOURCE"
          data={chartData.generator}
          totalLabel="tickets"
          theme="blue"
          isLoading={isDataLoading}
          selectedMonth={generatorMonth}
          onMonthChange={setGeneratorMonth}
        />
        <GeneratorListCard
          title="OPERATOR ASSIGNED & SUB-ASSIGNED"
          data={chartData.operatorWorkload}
          totalLabel=""
          theme="purple"
          isLoading={isDataLoading}
          selectedMonth={operatorWorkloadMonth}
          onMonthChange={setOperatorWorkloadMonth}
        />
        <GeneratorListCard
          title="RESOLVED TICKETS BY OPERATOR"
          data={chartData.operatorResolved}
          totalLabel="resolved"
          theme="emerald"
          isLoading={isDataLoading}
          selectedMonth={operatorResolvedMonth}
          onMonthChange={setOperatorResolvedMonth}
        />

        {/* SLA Health Distribution Card */}
        <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              SLA Health Distribution
            </h4>
            {isDataLoading ? (
              <div className="h-6 w-16 bg-slate-200 rounded-lg animate-pulse" />
            ) : (
              <span className="text-xs font-bold px-2.5 py-1 bg-rose-50 text-rose-700 rounded-lg border border-rose-100">
                Risk: {stats.slaRisk}
              </span>
            )}
          </div>

          {isDataLoading ? (
            <div className="flex flex-col xl:flex-row items-center gap-4 my-3 animate-pulse">
              <div className="h-32 w-32 rounded-full bg-slate-200 shrink-0 mx-auto" />
              <div className="w-full flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-7 bg-slate-100 rounded-lg w-full" />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col xl:flex-row items-center justify-around gap-4 my-2">
              <div className="h-36 w-36 relative flex items-center justify-center shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.slaPie}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={54}
                      paddingAngle={4}
                      dataKey="value"
                      isAnimationActive={true}
                      animationDuration={400}
                    >
                      {chartData.slaPie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="w-full xl:w-1/2 flex flex-col gap-2 text-xs">
                {chartData.slaPie.map((item, idx) => (
                  <div
                    key={`sla-point-${idx}`}
                    className="flex items-center justify-between bg-slate-50/80 px-3 py-2 rounded-xl border border-slate-100 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-semibold text-slate-700">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="text-slate-900">{item.value}</span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        ({item.percentage}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 italic">
            <span>Proportional breakdown of active SLAs.</span>
            {isDataLoading ? (
              <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
            ) : (
              <span className="font-medium text-slate-500">
                Total Monitored: {stats.total}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Active Time & Monthly Average Card (Crash-Proofed) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100 mt-6 transition-all duration-300">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3">User Active Time & Monthly Averages</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 min-w-[650px]">
            <thead className="bg-gray-50 uppercase text-xs text-gray-500">
              <tr>
                <th className="p-3">User / Operator</th>
                <th className="p-3">Role</th>
                <th className="p-3">Total Active Hours (Login/Logout)</th>
                <th className="p-3">Monthly Average Active Hours</th>
              </tr>
            </thead>
            <tbody>
              {isDataLoading ? (
                [1, 2].map((i) => (
                  <tr key={i} className="border-b animate-pulse">
                    <td className="p-3"><div className="h-4 bg-slate-200 rounded w-32" /></td>
                    <td className="p-3"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                    <td className="p-3"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                    <td className="p-3"><div className="h-4 bg-slate-200 rounded w-28" /></td>
                  </tr>
                ))
              ) : Array.isArray(activeTimes) && activeTimes.length > 0 ? (
                activeTimes.map((item, index) => {
                  const overallMs = item?.totalOverallMs ?? 0;
                  const fallbackOverallHours = item?.totalActiveHours ?? 0;
                  const totalHours = overallMs > 0 ? overallMs / (1000 * 60 * 60) : fallbackOverallHours;

                  const avgMs = item?.avgMonthlyActiveMs ?? 0;
                  const fallbackAvgHours = item?.monthlyAverageActiveHours ?? 0;
                  const avgHours = avgMs > 0 ? avgMs / (1000 * 60 * 60) : fallbackAvgHours;

                  return (
                    <tr key={item?._id || index} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-3 font-medium text-gray-900">{item?.name || "Unknown User"}</td>
                      <td className="p-3">{item?.role || "Operator"}</td>
                      <td className="p-3">
                        {Number(totalHours || 0).toFixed(2)} hrs
                      </td>
                      <td className="p-3">
                        {Number(avgHours || 0).toFixed(2)} hrs / mo
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" className="p-4 text-center text-gray-400">No login/logout session activity records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Month-on-Month Tickets Breakdown Card with Filter */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100 mt-6 transition-all duration-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800">Month-on-Month Ticket Breakdown</h3>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor="mom-month-select" className="text-xs text-gray-500 font-medium whitespace-nowrap">
              Filter Month:
            </label>
            <select
              id="mom-month-select"
              value={selectedMomMonth}
              onChange={(e) => setSelectedMomMonth(e.target.value)}
              className="text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer transition-all w-full sm:w-auto"
            >
              {[
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
              ].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isDataLoading ? (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 h-20 animate-pulse flex flex-col justify-center gap-2">
              <div className="h-4 bg-slate-200 rounded w-28" />
              <div className="h-3 bg-slate-200 rounded w-40" />
            </div>
          ) : filteredMonthData.length > 0 ? (
            filteredMonthData.map((row, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col justify-between transition-all hover:shadow-xs">
                <div>
                  <span className="text-sm font-bold text-gray-700">Period: {row.period}</span>
                  <p className="text-xs text-gray-500 mt-1">
                    Created: <span className="font-semibold text-blue-600">{row.ticketsCreated}</span> | Resolved: <span className="font-semibold text-green-600">{row.ticketsResolved}</span>
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full p-6 text-center text-xs text-gray-400 italic">
              No ticket metrics found for {selectedMomMonth}.
            </div>
          )}
        </div>
      </div>

      {/* Velocity Trend Chart */}
      <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Ticket Intake Velocity Trend
          </h4>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <label
              htmlFor="velocity-days-select"
              className="text-xs text-slate-500 font-medium"
            >
              View Days (1–30):
            </label>
            <select
              id="velocity-days-select"
              value={velocityDays}
              onChange={(e) =>
                setVelocityDays(
                  Math.max(1, Math.min(30, Number(e.target.value))),
                )
              }
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer transition-all"
            >
              {[1, 3, 7, 14, 21, 30].map((d) => (
                <option key={d} value={d}>
                  {d} Days
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="h-32 w-full mt-3">
          {isDataLoading ? (
            <div className="w-full h-full bg-slate-100 rounded-xl animate-pulse flex items-center justify-center">
              <span className="text-xs text-slate-400 font-medium">Loading velocity analytics...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
              <LineChart
                data={chartData.trend}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="day"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="tickets"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{
                    r: 4,
                    fill: "#10b981",
                    strokeWidth: 2,
                    stroke: "#ffffff",
                  }}
                  activeDot={{
                    r: 6,
                    fill: "#059669",
                    strokeWidth: 2,
                    stroke: "#ffffff",
                  }}
                  isAnimationActive={true}
                  animationDuration={400}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 italic">
          Daily volume intake pattern over the selected {velocityDays}-day window.
        </div>
      </div>

      {/* Priority Summary & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-amber-500 shrink-0" />
          <span className="text-xs font-bold uppercase text-slate-700 tracking-wider">
            Priority Breakdown & Filters:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {[
            { key: "all", label: "All Priorities", count: stats.total },
            {
              key: "critical",
              label: "Critical",
              count: stats.byPriority["Critical"],
              resolved: stats.byPriorityResolved["Critical"],
            },
            {
              key: "high",
              label: "High",
              count: stats.byPriority["High"],
              resolved: stats.byPriorityResolved["High"],
            },
            {
              key: "medium",
              label: "Medium",
              count: stats.byPriority["Medium"],
              resolved: stats.byPriorityResolved["Medium"],
            },
            {
              key: "low",
              label: "Low",
              count: stats.byPriority["Low"],
              resolved: stats.byPriorityResolved["Low"],
            },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => setSelectedPriorityFilter(p.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 cursor-pointer flex-1 sm:flex-none justify-center ${
                selectedPriorityFilter === p.key
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <span>{p.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] ${selectedPriorityFilter === p.key ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200"}`}
              >
                {p.count || 0}{" "}
                {p.resolved !== undefined ? `(${p.resolved} res)` : ""}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters and Search Toolbar */}
      <div className="px-4 sm:px-6 py-4 bg-white border border-slate-200/80 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="relative w-full md:max-w-sm">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search by Ticket ID or Title..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50/75 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-2xl placeholder:text-slate-400 text-slate-800"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full md:w-auto justify-center flex-wrap">
          {[
            { key: "all", label: "All Work" },
            { key: "unassigned", label: "Unassigned" },
            { key: "open", label: "Open" },
            { key: "assigned", label: "Assigned" },
            { key: "closed", label: "Closed" },
            { key: "sla-risk", label: "SLA Risks" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex-1 sm:flex-none text-center ${
                selectedTab === tab.key
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all duration-300">
        {isDataLoading ? (
          <div className="p-8 space-y-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-xl w-full" />
            ))}
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-400 italic flex flex-col items-center gap-2">
            <svg
              className="w-9 h-9 text-slate-300"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7m16 0v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5m16 0h-2.586a1 1 0 0 0-.707.293l-2.414 2.414a1 1 0 0 1-.707.293h-3.172a1 1 0 0 1-.707-.293l-2.414-2.414A1 1 0 0 0 6.586 13H4"
              />
            </svg>
            No tickets found matching the selected filter parameters.
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs text-slate-600 border-collapse min-w-[1750px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">ID</th>
                  <th className="py-3.5 px-4 font-semibold">Source</th>
                  <th className="py-3.5 px-4 font-semibold">Created</th>
                  <th className="py-3.5 px-4 font-semibold">Title</th>
                  <th className="py-3.5 px-4 font-semibold">Category</th>
                  <th className="py-3.5 px-4 font-semibold">Priority</th>
                  <th className="py-3.5 px-4 font-semibold">Primary Assignee</th>
                  <th className="py-3.5 px-4 font-semibold">Primary Assignment Timeline</th>
                  <th className="py-3.5 px-4 font-semibold">Primary Duration</th>
                  <th className="py-3.5 px-4 font-semibold">Sub-Assignee</th>
                  <th className="py-3.5 px-4 font-semibold">Sub-Assignment Timeline</th>
                  <th className="py-3.5 px-4 font-semibold">Sub-Assignee Duration</th>
                  <th className="py-3.5 px-4 font-semibold">SLA Health</th>
                  <th className="py-3.5 px-4 font-semibold">Status & Total Resolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map((t) => (
                  <TableRowItem
                    key={t._id || t.id}
                    t={t}
                    isUserManagerOrAdmin={isUserManagerOrAdmin}
                    operators={operators}
                    handleAssignToMe={handleAssignToMe}
                    handleManagerAssign={handleManagerAssign}
                    formatDate={formatDate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;