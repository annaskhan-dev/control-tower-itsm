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
import api from "../services/api";
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

  const slaTimeMs = isAssigned
    ? Math.max(0, currentOrResolveTime - assignedAtTime)
    : 0;

  let subAssignmentTimeMs = 0;
  if (isSubAssigned && subAssignedAtTime) {
    subAssignmentTimeMs = Math.max(0, currentOrResolveTime - subAssignedAtTime);
  }

  const finalResolutionTimeMs = isResolved
    ? Math.max(0, resolvedAtTime - createdAtTime)
    : null;

  const formatDuration = (ms) => {
    if (ms === null || ms === undefined || isNaN(ms)) return "—";
    if (ms < 60000) return "Just now";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours === 0 && mins === 0) return "Just now";
    return `${hours}h ${mins}m`;
  };

  return {
    ...t,
    id: t._id || t.id || t.ticketId || t.code || "N/A",
    ticketId: t.ticketId || t.id || t._id || t.code || "N/A",
    title: t.title || t.subject || t.name || t.description || "Untitled Ticket",
    entrySource: rawSourceStr,
    assigneeName,
    subAssignmentName,
    subAssignmentAt: subAssignedAtRaw,
    status: t.status || "Open",
    createdAt: t.createdAt || t.created_at || new Date().toISOString(),
    priority,
    category: rawCategoryStr,
    slaStatus: sla,
    isResolved,
    isSubAssigned,
    isAssigned,
    assignmentTimeFormatted: isAssigned
      ? formatDuration(primaryAssignmentMs)
      : "Unassigned",
    slaTimeFormatted: isAssigned ? formatDuration(slaTimeMs) : "N/A",
    subAssignmentTimeFormatted: isSubAssigned
      ? formatDuration(subAssignmentTimeMs)
      : "Not Sub-Assigned",
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
      <div className="bg-slate-900/95 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-xl shadow-xl border border-slate-700/65">
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
 * List-based Card for Creators & Sources (supports custom color themes)
 */
const GeneratorListCard = memo(
  ({ title, data, totalLabel = "total", theme = "emerald" }) => {
    const totalValue = useMemo(
      () => data.reduce((acc, curr) => acc + (Number(curr.count) || 0), 0),
      [data],
    );

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
    };

    const currentTheme = themeStyles[theme] || themeStyles.emerald;

    return (
      <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs hover:shadow-md transition-shadow duration-200 flex flex-col justify-between h-72">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers size={16} className={currentTheme.iconColor} />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {title}
              </h4>
            </div>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${currentTheme.badgeBg}`}
            >
              Total: {totalValue}
            </span>
          </div>
        </div>

        <div className="my-2 flex-1 overflow-y-auto space-y-2 pr-1">
          {data.length > 0 ? (
            data.map((item, idx) => (
              <div
                key={`gen-row-${idx}`}
                className="flex items-center justify-between py-1"
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
              No metrics available
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
  const loading = contextLoading && (!tickets || tickets.length === 0);

  const [backendStats, setBackendStats] = useState(null);
  const [now, setNow] = useState(() => new Date());

  // UI controls state
  const [velocityDays, setVelocityDays] = useState(7);
  const [selectedTab, setSelectedTab] = useState("all");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [operators, setOperators] = useState([]);

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
    const getStatsData = async () => {
      if (hasFetchedStatsRef.current) return;
      hasFetchedStatsRef.current = true;

      try {
        const data = await fetchTicketStats();
        if (data && isMounted) {
          setBackendStats(data);
        }
      } catch (err) {
        console.error("Failed to load backend stats:", err);
      }
    };
    getStatsData();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const fetchOperatorsList = async () => {
      try {
        const response = await api.get("/users");
        const allUsers = response.data || [];
        const filteredOps = allUsers.filter((u) => {
          const r = (u.role || u.userType || "")
            .replace(/\s+/g, "_")
            .toLowerCase();
          return (
            r.includes("operator") ||
            r.includes("transporter") ||
            !r.includes("admin")
          );
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
      if (!selectedOperatorName) return;
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

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const d = new Date(dateString);
    return isNaN(d.getTime())
      ? "Invalid"
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
          ", " +
          d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleExportExcel = () => {
    const currentDate = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(currentDate.getMonth() - 1);

    const recentTickets = normalizedTickets.filter((t) => {
      if (!t.createdAt) return true;
      const ticketDate = new Date(t.createdAt);
      return isNaN(ticketDate.getTime()) || ticketDate >= oneMonthAgo;
    });

    if (recentTickets.length === 0) {
      alert("No ticket data found to export for the last month.");
      return;
    }

    const headers = [
      "Ticket ID",
      "Title",
      "Description",
      "Source",
      "Category",
      "Priority",
      "Ticket Status",
      "SLA Health",
      "SLA Deadline",
      "Assignee",
      "Assigned At",
      "Assignment Duration",
      "SLA Active Duration",
      "Sub-Assignee",
      "Sub-Assigned At",
      "Sub-Assignment Duration",
      "Resolved At",
      "Final Resolution Duration",
      "Company ID",
      "Created At",
    ];

    const csvRows = recentTickets.map((t) => {
      const createdAtFormatted = t.createdAt
        ? new Date(t.createdAt).toLocaleString()
        : "";
      const assignedAtFormatted = t.assignedAt
        ? new Date(t.assignedAt).toLocaleString()
        : "";
      const subAssignmentAtFormatted = t.subAssignmentAt
        ? new Date(t.subAssignmentAt).toLocaleString()
        : "";
      const resolvedAtFormatted = t.resolvedAt
        ? new Date(t.resolvedAt).toLocaleString()
        : "";
      const slaDeadlineFormatted = t.slaDeadline
        ? new Date(t.slaDeadline).toLocaleString()
        : "";

      return [
        `"${(t.ticketId || "").toString().replace(/"/g, '""')}"`,
        `"${(t.title || "").replace(/"/g, '""')}"`,
        `"${(t.description || "").replace(/"/g, '""')}"`,
        `"${(t.entrySource || "").replace(/"/g, '""')}"`,
        `"${(t.category || "").replace(/"/g, '""')}"`,
        `"${(t.priority || "").replace(/"/g, '""')}"`,
        `"${(t.status || "").replace(/"/g, '""')}"`,
        `"${(t.slaStatus || "").replace(/"/g, '""')}"`,
        `"${slaDeadlineFormatted}"`,
        `"${(t.assigneeName || "").replace(/"/g, '""')}"`,
        `"${assignedAtFormatted}"`,
        `"${t.assignmentTimeFormatted || "Unassigned"}"`,
        `"${t.slaTimeFormatted || "N/A"}"`,
        `"${(t.subAssignmentName || "").replace(/"/g, '""')}"`,
        `"${subAssignmentAtFormatted}"`,
        `"${t.subAssignmentTimeFormatted || "Not Sub-Assigned"}"`,
        `"${resolvedAtFormatted}"`,
        `"${t.finalResolutionTimeFormatted || "Pending"}"`,
        `"${(t.companyId || "").toString().replace(/"/g, '""')}"`,
        `"${createdAtFormatted}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `comprehensive_tickets_report_last_month_${currentDate.toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Comprehensive Metrics Calculation
  const stats = useMemo(() => {
    let generatorMap = {};
    let operatorResolvedMap = {};
    let priorityMap = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    let priorityResolvedMap = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    let slaHealthMap = { "On Track": 0, "At Risk": 0, Breached: 0 };

    let assignedCount = 0;
    let unassignedCount = 0;
    let closedCount = 0;
    let openCount = 0;

    normalizedTickets.forEach((t) => {
      const src = t.entrySource || "Direct System";
      generatorMap[src] = (generatorMap[src] || 0) + 1;

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
        if (isClosed) {
          operatorResolvedMap[t.assigneeName] =
            (operatorResolvedMap[t.assigneeName] || 0) + 1;
        }
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
      byGenerator: generatorMap,
      byOperatorResolved: operatorResolvedMap,
      byPriority: priorityMap,
      byPriorityResolved: priorityResolvedMap,
      slaHealth: slaHealthMap,
    };
  }, [normalizedTickets, backendStats]);

  // Dynamic Chart & Trend Data
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

    const generatorEntries = Object.entries(stats.byGenerator || {})
      .map(([name, count]) => ({
        name,
        count: Number(count) || 0,
      }))
      .filter((d) => d.count > 0);

    const operatorResolvedEntries = Object.entries(
      stats.byOperatorResolved || {},
    )
      .map(([name, count]) => ({
        name,
        count: Number(count) || 0,
      }))
      .filter((d) => d.count > 0);

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
      trend,
      slaPie: slaPieEntries,
    };
  }, [normalizedTickets, stats, velocityDays]);

  // Filtered tickets based on active tab, priority filter, search term, and permissions
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

  if (loading)
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 font-sans text-slate-800 p-4 sm:p-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Operational Dashboard
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time ticketing lifecycle, creator tracking, operator resolution
            metrics, and SLA health
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
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
          <button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer justify-center flex-1 sm:flex-none"
          >
            <Download size={16} /> Export to Excel
          </button>
        </div>
      </div>

      {/* Top Metric Cards - 6 Columns Expanded */}
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
            className={`p-4 bg-white border rounded-2xl flex items-center justify-between shadow-xs hover:shadow-md transition cursor-pointer ${
              selectedTab === item.tab
                ? "border-blue-500 ring-2 ring-blue-100"
                : "border-slate-200/80"
            }`}
          >
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {item.label}
              </p>
              <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                {item.val}
              </h3>
            </div>
            <div
              className={`p-2.5 rounded-xl ${selectedTab === item.tab ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-600"}`}
            >
              <item.icon size={18} />
            </div>
          </div>
        ))}
      </div>

      {/* Widgets Grid: Generators, Operators, and Detailed SLA Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <GeneratorListCard
          title="TICKETS CREATED BY ROLE / SOURCE"
          data={chartData.generator}
          totalLabel="tickets"
          theme="blue"
        />
        <GeneratorListCard
          title="RESOLVED TICKETS BY OPERATOR"
          data={chartData.operatorResolved}
          totalLabel="resolved"
          theme="emerald"
        />

        {/* Enhanced SLA Health Distribution Card with 3 Key Detail Points */}
        <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              SLA Health Distribution
            </h4>
            <span className="text-xs font-bold px-2.5 py-1 bg-rose-50 text-rose-700 rounded-lg border border-rose-100">
              Risk: {stats.slaRisk}
            </span>
          </div>

          <div className="flex flex-col xl:flex-row items-center gap-2 my-1">
            <div className="h-32 w-full xl:w-1/2">
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
                  >
                    {chartData.slaPie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 3 Detail Points for SLA Categories */}
            <div className="w-full xl:w-1/2 flex flex-col gap-1.5 text-xs">
              {chartData.slaPie.map((item, idx) => (
                <div
                  key={`sla-point-${idx}`}
                  className="flex items-center justify-between bg-slate-50/80 p-1.5 rounded-lg border border-slate-100"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-semibold text-slate-700">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 font-bold">
                    <span className="text-slate-900">{item.value}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({item.percentage}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 italic">
            <span>Proportional breakdown of active SLAs.</span>
            <span className="font-medium text-slate-500">
              Total Monitored: {stats.total}
            </span>
          </div>
        </div>
      </div>

      {/* Velocity Trend Chart with Days Selector */}
      <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Ticket Intake Velocity Trend
          </h4>
          <div className="flex items-center gap-2">
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
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
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
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 italic">
          Daily volume intake pattern over the selected {velocityDays}-day
          window.
        </div>
      </div>

      {/* Priority Summary & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-amber-500" />
          <span className="text-xs font-bold uppercase text-slate-700 tracking-wider">
            Priority Breakdown & Filters:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border flex items-center gap-1.5 cursor-pointer ${
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
      <div className="px-6 py-4 bg-white border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="relative w-full max-w-sm">
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
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50/75 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-2xs placeholder:text-slate-400 text-slate-800"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Status Tab Filters */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto justify-center flex-wrap">
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
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

      {/* Main Table Section (Unified with Ticket List Styling & Columns) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredTickets.length === 0 ? (
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse min-w-[1250px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Ticket ID</th>
                  <th className="py-3.5 px-4 font-semibold">Source</th>
                  <th className="py-3.5 px-4 font-semibold">Created At</th>
                  <th className="py-3.5 px-4 font-semibold">Title</th>
                  <th className="py-3.5 px-4 font-semibold">Category</th>
                  <th className="py-3.5 px-4 font-semibold">Priority</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">SLA Health</th>
                  <th className="py-3.5 px-4 font-semibold">Assignee</th>
                  <th className="py-3.5 px-4 font-semibold">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map((t) => {
                  const mongoId = t._id || t.id;
                  const isResolvedState =
                    t.isResolved ||
                    ["closed", "resolved", "completed", "done"].includes(
                      (t.status || "").toLowerCase(),
                    );
                  const isRestricted = !isUserManagerOrAdmin;

                  return (
                    <tr
                      key={mongoId}
                      onClick={() => navigate(`/tickets/${t.ticketId}`)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      {/* Ticket ID */}
                      <td className="py-3.5 px-4 font-semibold text-blue-600 group-hover:text-blue-700 whitespace-nowrap">
                        {t.ticketId}
                      </td>

                      {/* Source */}
                      <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-[11px]">
                          {t.entrySource}
                        </span>
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {formatDate(t.createdAt)}
                      </td>

                      {/* Title */}
                      <td
                        className="py-3.5 px-4 font-medium text-slate-900 max-w-[220px] truncate"
                        title={t.title}
                      >
                        {t.title}
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {t.category || "—"}
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
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

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 font-bold uppercase rounded-md text-[10px] tracking-wider shadow-2xs inline-block ${
                            isResolvedState
                              ? "bg-emerald-600 text-white"
                              : "bg-blue-600 text-white"
                          }`}
                        >
                          {t.status || "Open"}
                        </span>
                      </td>

                      {/* SLA Health */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                            t.slaStatus === "Breached"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : t.slaStatus === "At Risk"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {t.slaStatus}
                        </span>
                      </td>

                      {/* Assignee */}
                      <td
                        className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t.isAssigned ? (
                          <span className="text-slate-800 font-medium">
                            {t.assigneeName}
                          </span>
                        ) : !isUserManagerOrAdmin ? (
                          <button
                            onClick={(e) => handleAssignToMe(e, mongoId)}
                            className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[11px] px-2.5 py-1 rounded-md font-medium transition-all shadow-2xs cursor-pointer"
                          >
                            Assign to Me
                          </button>
                        ) : (
                          <div className="relative">
                            <select
                              value={t.assignee || t.assignedTo || "Unassigned"}
                              disabled={isRestricted || isResolvedState}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleManagerAssign(mongoId, e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full py-1 px-2 border border-slate-200 rounded-md text-[11px] bg-white text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                            >
                              <option value="Unassigned">
                                Assign to Operator...
                              </option>
                              {operators.map((u) => {
                                const userName =
                                  u.name || u.fullName || u.username;
                                const userRole =
                                  u.role || u.userType || "Operator";
                                return (
                                  <option key={u._id || u.id} value={userName}>
                                    {userName} ({userRole})
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        )}
                      </td>

                      {/* Duration / Resolution */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-[11px] font-medium ${isResolvedState ? "text-emerald-700 font-semibold" : "text-slate-400 italic"}`}
                        >
                          {isResolvedState
                            ? `Res: ${t.finalResolutionTimeFormatted}`
                            : t.assignmentTimeFormatted}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;