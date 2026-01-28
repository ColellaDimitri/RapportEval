import { useEffect, useMemo, useRef, useState } from "react";
import clientPackage from "../package.json";

const DEFAULT_COMPETENCY_OPTIONS = [
  {
    code: "OO1",
    description:
      "Définir la configuration des services du serveur nécessaires (service d’annuaire, DHCP, DNS, File, Print) conformément aux directives de l’entreprise."
  },
  {
    code: "OO2",
    description:
      "Installer et configurer les services réseau en appliquant les bonnes pratiques de sécurité."
  },
  {
    code: "OO3",
    description:
      "Valider le fonctionnement des services déployés et documenter la configuration."
  }
];

const DEFAULT_COMPETENCIES = [
  {
    category: "Active Directory",
    items: [
      {
        task:
          "Connait les principes théoriques et la terminologie associée au service et concepts d'annuaire",
        competencyId: "OO1"
      },
      {
        task:
          "Est capable d'installer le rôle Active Directory, de promouvoir un DC et de créer un admin du domaine",
        competencyId: "OO2"
      },
      {
        task: "Est capable de joindre des clients/serveurs au domaine",
        competencyId: "OO3"
      }
    ]
  },
  {
    category: "DNS",
    items: [
      {
        task:
          "Connait les principes théoriques, la terminologie et les outils liés aux services et concepts du DNS",
        competencyId: "OO1"
      },
      {
        task:
          "Connait les principes théoriques liés au déroulement d'une résolution DNS",
        competencyId: "OO1"
      },
      {
        task:
          "Est capable de configurer des zones de recherches directes et inverses",
        competencyId: "OO2"
      },
      {
        task:
          "Est capable de configurer des records dans des zones de recherches directes ou inverses et de les tester",
        competencyId: "OO2"
      }
    ]
  },
  {
    category: "DHCP",
    items: [
      {
        task:
          "Connait les principes théoriques et la terminologie associée aux services et concepts du DHCP",
        competencyId: "OO1"
      },
      {
        task:
          "Connait les principes théoriques liés au déroulement de l'attribution d'un bail DHCP",
        competencyId: "OO1"
      },
      {
        task:
          "Est capable d'installer, d'autoriser un service DHCP et de configurer un scope d'adresse et une réservation",
        competencyId: "OO2"
      },
      {
        task:
          "Est capable de configurer les options d'un scope et de tester l'attribution d'un bail à un client",
        competencyId: "OO2"
      }
    ]
  }
];

const EVALUATION_TYPES = ["E1", "E2", "E3"];
const TASK_EVALUATION_METHODS = [
  { value: "Evaluation écrite", label: "📝 Evaluation écrite" },
  { value: "Evaluation pratique", label: "🧪 Evaluation pratique" },
  { value: "Documentation", label: "📚 Documentation" }
];
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const CLIENT_VERSION = clientPackage.version || "dev";
const AUTH_STORAGE_KEY = "erapport.auth";

const STATUS_VALUES = {
  OK: "OK",
  NEEDS_IMPROVEMENT: "~",
  NOT_ASSESSED: "NOK"
};
const SERVER_STATUS_LABELS = {
  ok: "En ligne",
  degraded: "Dégradé",
  offline: "Hors ligne",
  unknown: "Inconnu"
};
const EVALUATION_COPY_PAIRS = [
  { source: "E1", target: "E2" },
  { source: "E2", target: "E3" }
];

const loadStoredAuth = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user) return null;
    return parsed;
  } catch (error) {
    console.error(error);
    return null;
  }
};

const persistStoredAuth = (payload) => {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error(error);
  }
};

const clearStoredAuth = () => {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (error) {
    console.error(error);
  }
};

const getStatusClass = (status) => {
  if (status === STATUS_VALUES.OK) return "status-ok";
  if (status === STATUS_VALUES.NEEDS_IMPROVEMENT) return "status-nok";
  if (status === STATUS_VALUES.NOT_ASSESSED) return "status-na";
  return "status-empty";
};

const getStudentNoteClass = (note) => {
  const numericNote = Number(note);
  if ([4, 5, 6].includes(numericNote)) return "note-ok";
  if ([1, 2, 3].includes(numericNote)) return "note-nok";
  return "";
};

const defaultTemplate = {
  moduleId: "",
  moduleTitle: "123 - Activer les services d'un serveur",
  schoolYear: "2025-2026",
  note: "",
  evaluationType: EVALUATION_TYPES[0],
  groupFeatureEnabled: false,
  summaryByCompetencies: false,
  className: "",
  teacher: "",
  evaluationDate: "",
  coachingDate: "",
  operationalCompetence: "",
  competencyOptions: DEFAULT_COMPETENCY_OPTIONS,
  competencies: DEFAULT_COMPETENCIES
};

const EMPTY_TEMPLATE = {
  competencyOptions: [],
  competencies: []
};

const normalizeTemplate = (template, module, schoolYearLabel, evaluationType) => {
  const baseTemplate = template || {};
  return {
    ...defaultTemplate,
    ...baseTemplate,
    moduleId: module.id,
    moduleTitle: module.title || "",
    schoolYear: schoolYearLabel || "",
    evaluationType:
      evaluationType || baseTemplate.evaluationType || defaultTemplate.evaluationType,
    groupFeatureEnabled: Boolean(baseTemplate.groupFeatureEnabled),
    summaryByCompetencies: Boolean(baseTemplate.summaryByCompetencies),
    competencyOptions:
      baseTemplate.competencyOptions || defaultTemplate.competencyOptions,
    competencies: baseTemplate.competencies || defaultTemplate.competencies
  };
};

const normalizeModuleTemplates = (module, schoolYearLabel) => {
  const hasExplicitTemplates =
    module.templates && typeof module.templates === "object";
  const baseTemplates = hasExplicitTemplates ? { ...module.templates } : {};
  if (!hasExplicitTemplates && module.template && !baseTemplates[EVALUATION_TYPES[0]]) {
    baseTemplates[EVALUATION_TYPES[0]] = module.template;
  }

  const normalizedTemplates = {};
  const templateTypes = Object.keys(baseTemplates).filter((type) =>
    EVALUATION_TYPES.includes(type)
  );
  if (templateTypes.length === 0) {
    const defaultType = EVALUATION_TYPES[0];
    normalizedTemplates[defaultType] = normalizeTemplate(
      {},
      module,
      schoolYearLabel,
      defaultType
    );
    return normalizedTemplates;
  }

  templateTypes.forEach((type) => {
    normalizedTemplates[type] = normalizeTemplate(
      baseTemplates[type] || {},
      module,
      schoolYearLabel,
      type
    );
  });

  return normalizedTemplates;
};

const getAvailableEvaluationTypes = (module) => {
  if (!module?.templates) return [EVALUATION_TYPES[0]];
  const availableTypes = EVALUATION_TYPES.filter((type) =>
    Boolean(module.templates[type])
  );
  return availableTypes.length ? availableTypes : [];
};

const isEvaluationTypeAvailable = (module, type) =>
  Boolean(module?.templates?.[type]);

const buildDefaultModule = (
  overrides = {},
  templateOverrides = {},
  schoolYearLabel = defaultTemplate.schoolYear
) => {
  const module = {
    id: crypto.randomUUID(),
    title: overrides.title ?? defaultTemplate.moduleTitle,
    schoolYear: overrides.schoolYear ?? schoolYearLabel
  };

  return {
    ...module,
    templates: normalizeModuleTemplates(
      {
        ...module,
        templates: {
          [EVALUATION_TYPES[0]]: templateOverrides
        }
      },
      schoolYearLabel
    )
  };
};

const getStudentEvaluationType = (student) =>
  student.evaluationType || EVALUATION_TYPES[0];

const getModuleTemplate = (module, schoolYearLabel, evaluationType) => {
  const templates = normalizeModuleTemplates(module, schoolYearLabel);
  return templates[evaluationType] || templates[EVALUATION_TYPES[0]];
};

const normalizeModules = (modules = [], schoolYearLabel) => {
  if (!Array.isArray(modules) || modules.length === 0) {
    return [];
  }

  return modules.map((module) => {
    const normalizedModule = {
      id: String(module.id ?? crypto.randomUUID()),
      title: module.title || "",
      schoolYear: schoolYearLabel
    };

    return {
      ...normalizedModule,
      templates: normalizeModuleTemplates(
        {
          ...normalizedModule,
          templates: normalizeModuleTemplates(module, schoolYearLabel)
        },
        schoolYearLabel
      )
    };
  });
};

const normalizeSchoolYears = (schoolYears = []) => {
  if (Array.isArray(schoolYears) && schoolYears.length > 0) {
    return schoolYears.map((schoolYear) => {
      const label =
        schoolYear.label ||
        schoolYear.schoolYear ||
        schoolYear.year ||
        defaultTemplate.schoolYear;
      return {
        id: String(schoolYear.id ?? crypto.randomUUID()),
        label,
        modules: normalizeModules(schoolYear.modules || [], label)
      };
    });
  }

  return [];
};

const buildDefaultSchoolYear = (label = defaultTemplate.schoolYear) => ({
  id: String(crypto.randomUUID()),
  label,
  modules: normalizeModules([], label)
});

const normalizeTemplateItem = (item, defaultGroupEvaluation = false) => {
  const hasGroupEvaluation =
    item && typeof item === "object" && "groupEvaluation" in item;
  const groupEvaluation = hasGroupEvaluation
    ? Boolean(item.groupEvaluation)
    : defaultGroupEvaluation;
  if (typeof item === "string") {
    return {
      task: item,
      competencyId: "",
      evaluationMethod: "",
      groupEvaluation
    };
  }
  return {
    task: item?.task || "",
    competencyId: item?.competencyId || "",
    evaluationMethod: item?.evaluationMethod || "",
    groupEvaluation
  };
};

const mapTemplateCompetencies = (template, existingCompetencies = []) => {
  const competencies = template?.competencies ?? [];

  return competencies.map((section) => {
    const existingSection = existingCompetencies.find(
      (candidate) => candidate.category === section.category
    );

    const items = section.items || [];
    const sectionGroupEvaluation = section.groupEvaluation ?? false;

    return {
      category: section.category,
      groupEvaluation: sectionGroupEvaluation,
      result: existingSection?.result ?? "",
      items: items.map((item) => {
        const normalizedItem = normalizeTemplateItem(item, sectionGroupEvaluation);
        const existingItem = existingSection?.items?.find((candidate) => {
          return (
            candidate.task === normalizedItem.task ||
            candidate.label === normalizedItem.task
          );
        });

        return {
          task: normalizedItem.task,
          competencyId: normalizedItem.competencyId || existingItem?.competencyId || "",
          evaluationMethod: normalizedItem.evaluationMethod || "",
          groupEvaluation: normalizedItem.groupEvaluation,
          status: existingItem?.status ?? "",
          comment: existingItem?.comment || ""
        };
      })
    };
  });
};

const getCompetencyLabel = (item, competencyOptions = []) => {
  const option = competencyOptions.find(
    (candidate) => candidate.code === item.competencyId
  );

  if (option) {
    return `${option.code} - ${option.description}`;
  }

  return "";
};

const getSummaryLabel = (
  section,
  competencyOptions = [],
  summaryByCompetencies = false
) => {
  if (!summaryByCompetencies) {
    return section.category || "";
  }

  const items = section.items || [];
  const seen = new Set();
  const labels = [];

  items.forEach((item) => {
    const competencyId = item.competencyId || "";
    if (!competencyId || seen.has(competencyId)) return;
    seen.add(competencyId);

    const option = competencyOptions.find(
      (candidate) => candidate.code === competencyId
    );
    labels.push(
      option ? `${option.code} - ${option.description}` : competencyId
    );
  });

  if (!labels.length) {
    return section.category || "";
  }

  return labels.join("\n");
};

const aggregateCompetencyStatus = (statuses = []) => {
  const normalized = statuses.filter(Boolean);
  if (!normalized.length) return "";
  if (normalized.includes(STATUS_VALUES.NOT_ASSESSED)) {
    return STATUS_VALUES.NOT_ASSESSED;
  }
  if (normalized.includes(STATUS_VALUES.NEEDS_IMPROVEMENT)) {
    return STATUS_VALUES.NEEDS_IMPROVEMENT;
  }
  if (normalized.every((status) => status === STATUS_VALUES.OK)) {
    return STATUS_VALUES.OK;
  }
  return normalized[0] || "";
};

const getCompetencySummaryRows = (
  sections = [],
  competencyOptions = []
) => {
  const items = sections.flatMap((section) => section.items || []);
  const summaryMap = new Map();
  const order = [];

  items.forEach((item) => {
    const competencyId = item.competencyId || "";
    if (!competencyId) return;
    if (!summaryMap.has(competencyId)) {
      summaryMap.set(competencyId, []);
      order.push(competencyId);
    }
    summaryMap.get(competencyId).push(item.status || "");
  });

  const rows = [];
  const optionCodes = new Set();
  competencyOptions.forEach((option) => {
    if (!option?.code || !summaryMap.has(option.code)) return;
    optionCodes.add(option.code);
    rows.push({
      competencyId: option.code,
      label: `${option.code} - ${option.description}`,
      result: aggregateCompetencyStatus(summaryMap.get(option.code))
    });
  });

  order.forEach((competencyId) => {
    if (optionCodes.has(competencyId)) return;
    rows.push({
      competencyId,
      label: competencyId,
      result: aggregateCompetencyStatus(summaryMap.get(competencyId))
    });
  });

  return rows;
};

const applyTemplateToStudent = (template, student, teacherId = "") => ({
  ...student,
  moduleId: template.moduleId || "",
  moduleTitle: template.moduleTitle || "",
  schoolYear: template.schoolYear || "",
  note: student.note ?? template.note ?? "",
  groupName: student.groupName || "",
  evaluationType: template.evaluationType || "",
  className: template.className || "",
  teacher: template.teacher || "",
  teacherId: student.teacherId || teacherId || "",
  evaluationDate: template.evaluationDate || "",
  coachingDate: template.coachingDate || "",
  operationalCompetence: template.operationalCompetence || "",
  summaryByCompetencies: Boolean(template.summaryByCompetencies),
  competencySummaryOverrides: student.competencySummaryOverrides || {},
  competencyOptions: template.competencyOptions || [],
  competencies: mapTemplateCompetencies(template, student.competencies)
});

const getStudentDisplayName = (student) => {
  const firstName = student.firstname?.trim() || "";
  const lastName = student.name?.trim() || "";
  return [firstName, lastName].filter(Boolean).join(" ");
};

const sanitizeFilename = (value) => {
  const normalized = String(value || "")
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return normalized ? normalized.slice(0, 60) : "rapport";
};

const sanitizeReportToken = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-z0-9]/gi, "");

const getModuleNumberToken = (moduleTitle) => {
  const firstWord = String(moduleTitle || "")
    .trim()
    .split(/\s+/)[0];
  return sanitizeReportToken(firstWord) || "module";
};

const getEvaluationLabel = (evaluationType) => {
  const normalized = String(evaluationType || "").trim().toUpperCase();
  return sanitizeReportToken(normalized) || "E1";
};

const getStudentNameToken = (student) => {
  const firstName = sanitizeReportToken(student?.firstname);
  const lastName = sanitizeReportToken(student?.name);
  return `${firstName}${lastName}` || "etudiant";
};

const buildReportFilename = (student) => {
  const moduleNumber = getModuleNumberToken(student?.moduleTitle);
  const evaluationLabel = getEvaluationLabel(student?.evaluationType);
  const studentName = getStudentNameToken(student);
  return `${moduleNumber}-${evaluationLabel}-${studentName}.pdf`;
};

const buildCoachingFilename = (student) => {
  const moduleNumber = getModuleNumberToken(student?.moduleTitle);
  const evaluationLabel = getEvaluationLabel(student?.evaluationType);
  const studentName = getStudentNameToken(student);
  return `${moduleNumber}-${evaluationLabel}-${studentName}-coaching.pdf`;
};

const hasStudentIdentity = (student) => getStudentDisplayName(student).length > 0;
const getStudentGroupName = (student) => student.groupName?.trim() || "";
const shouldIncludeCoaching = (student) => {
  const numericNote = Number(student?.note);
  return [1, 2, 3].includes(numericNote);
};

const syncGroupEvaluations = (student, groupName, studentsPool) => {
  if (!groupName) {
    return { ...student, groupName };
  }

  const peerStudent = studentsPool.find(
    (candidate) =>
      candidate.id !== student.id &&
      candidate.moduleId === student.moduleId &&
      getStudentEvaluationType(candidate) === getStudentEvaluationType(student) &&
      getStudentGroupName(candidate) === groupName
  );

  if (!peerStudent) {
    return { ...student, groupName };
  }

  const peerCompetencies = peerStudent.competencies || [];
  const updatedCompetencies = (student.competencies || []).map(
    (section, sectionIndex) => {
      const peerSection = peerCompetencies[sectionIndex];
      if (!peerSection) return section;
      return {
        ...section,
        items: (section.items || []).map((item, itemIndex) => {
          const peerItem = peerSection.items?.[itemIndex];
          if (!peerItem) return item;
          const isGroupEvaluation =
            typeof item.groupEvaluation === "boolean"
              ? item.groupEvaluation
              : Boolean(section.groupEvaluation);
          if (!isGroupEvaluation) return item;
          return {
            ...item,
            status: peerItem.status ?? "",
            comment: peerItem.comment ?? ""
          };
        })
      };
    }
  );

  return {
    ...student,
    groupName,
    competencies: updatedCompetencies
  };
};

const buildStudentFromTemplate = (template, teacherId = "") => ({
  id: crypto.randomUUID(),
  name: "",
  firstname: "",
  email: "",
  moduleId: template.moduleId || "",
  moduleTitle: template.moduleTitle || "",
  schoolYear: template.schoolYear || "",
  note: template.note || "",
  remarks: "",
  groupName: "",
  evaluationType: template.evaluationType || "",
  className: template.className || "",
  teacher: template.teacher || "",
  teacherId,
  evaluationDate: template.evaluationDate || "",
  coachingDate: template.coachingDate || "",
  operationalCompetence: template.operationalCompetence || "",
  summaryByCompetencies: Boolean(template.summaryByCompetencies),
  competencySummaryOverrides: {},
  competencyOptions: template.competencyOptions || [],
  competencies: mapTemplateCompetencies(template)
});

const ensureStudentTeacher = (student, templateTeacher, fallbackTeacher) => {
  const teacher =
    String(student?.teacher || "").trim() ||
    String(templateTeacher || "").trim() ||
    String(fallbackTeacher || "").trim();
  return teacher ? { ...student, teacher } : student;
};

const cloneStudentReport = (student, evaluationType) => {
  const clonedStudent = JSON.parse(JSON.stringify(student));
  return {
    ...clonedStudent,
    id: crypto.randomUUID(),
    evaluationType
  };
};

function App() {
  const [authUser, setAuthUser] = useState(() => loadStoredAuth()?.user || null);
  const [authToken, setAuthToken] = useState(() => loadStoredAuth()?.token || "");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [schoolYears, setSchoolYears] = useState([]);
  const [template, setTemplate] = useState(defaultTemplate);
  const [activeSchoolYearId, setActiveSchoolYearId] = useState("");
  const [activeModuleId, setActiveModuleId] = useState("");
  const [activeEvaluationType, setActiveEvaluationType] = useState(
    EVALUATION_TYPES[0]
  );
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(() =>
    buildStudentFromTemplate(defaultTemplate, authUser?.id)
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isImportStudentModalOpen, setIsImportStudentModalOpen] = useState(false);
  const [isCopyStudentsModalOpen, setIsCopyStudentsModalOpen] = useState(false);
  const [isMailDraftModalOpen, setIsMailDraftModalOpen] = useState(false);
  const [mailDraftSubject, setMailDraftSubject] = useState("");
  const [mailDraftBody, setMailDraftBody] = useState("");
  const [importStudentText, setImportStudentText] = useState("");
  const [importStudentError, setImportStudentError] = useState("");
  const [copyStudentSelections, setCopyStudentSelections] = useState({});
  const [copyConfig, setCopyConfig] = useState(EVALUATION_COPY_PAIRS[0]);
  const [showDetails, setShowDetails] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverTask, setDragOverTask] = useState(null);
  const [serverStatus, setServerStatus] = useState({
    status: "unknown",
    version: ""
  });
  const isHydratedRef = useRef(false);
  const isAuthenticated = Boolean(authToken && authUser);
  const teacherId = authUser?.id || "";
  const teacherName = useMemo(
    () => authUser?.name || authUser?.email || "",
    [authUser]
  );
  const moduleStudents = useMemo(() => {
    const filtered = students.filter(
      (student) =>
        student.moduleId === activeModuleId &&
        getStudentEvaluationType(student) === activeEvaluationType
    );

    return filtered.sort((a, b) => {
      const lastNameA = String(a?.name || "").trim().toLowerCase();
      const lastNameB = String(b?.name || "").trim().toLowerCase();
      if (lastNameA !== lastNameB) {
        return lastNameA.localeCompare(lastNameB, "fr", { sensitivity: "base" });
      }
      const firstNameA = String(a?.firstname || "").trim().toLowerCase();
      const firstNameB = String(b?.firstname || "").trim().toLowerCase();
      return firstNameA.localeCompare(firstNameB, "fr", { sensitivity: "base" });
    });
  }, [activeEvaluationType, activeModuleId, students]);
  const moduleStats = useMemo(() => {
    let successCount = 0;
    let failureCount = 0;
    moduleStudents.forEach((student) => {
      const numericNote = Number(student.note);
      if (!Number.isFinite(numericNote)) return;
      if (numericNote >= 4) {
        successCount += 1;
      } else if (numericNote > 0) {
        failureCount += 1;
      }
    });
    const totalCount = successCount + failureCount;
    const successPercent = totalCount
      ? Math.round((successCount / totalCount) * 100)
      : 0;
    const failurePercent = totalCount
      ? Math.round((failureCount / totalCount) * 100)
      : 0;
    return {
      successCount,
      failureCount,
      successPercent,
      failurePercent,
      totalCount
    };
  }, [moduleStudents]);
  const summaryRows = useMemo(() => {
    if (!draft.summaryByCompetencies) {
      return (draft.competencies || []).map((section) => ({
        label: getSummaryLabel(
          section,
          draft.competencyOptions,
          draft.summaryByCompetencies
        ),
        result: section.result
      }));
    }

    return getCompetencySummaryRows(
      draft.competencies,
      draft.competencyOptions
    );
  }, [
    draft.competencies,
    draft.competencyOptions,
    draft.summaryByCompetencies
  ]);
  const groupOptions = useMemo(() => {
    const groupSet = new Set();
    moduleStudents.forEach((student) => {
      const groupName = getStudentGroupName(student);
      if (groupName) {
        groupSet.add(groupName);
      }
    });
    return Array.from(groupSet);
  }, [moduleStudents]);
  const selectedStudent = moduleStudents.find(
    (student) => student.id === selectedId
  );
  const clientVersion = CLIENT_VERSION;
  const normalizedServerStatus = ["ok", "degraded", "offline"].includes(
    serverStatus.status
  )
    ? serverStatus.status
    : "unknown";
  const serverStatusLabel =
    SERVER_STATUS_LABELS[normalizedServerStatus] || SERVER_STATUS_LABELS.unknown;
  const serverVersionLabel = serverStatus.version || "—";
  const statusIndicatorClass = `status-indicator status-indicator--${normalizedServerStatus}`;
  const logClientEvent = async (event, payload) => {
    if (!authToken) return;
    try {
      await fetch(`${API_BASE_URL}/api/logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ event, payload })
      });
    } catch (error) {
      console.error(error);
    }
  };
  const activeSchoolYear = useMemo(
    () => schoolYears.find((year) => year.id === activeSchoolYearId) || null,
    [activeSchoolYearId, schoolYears]
  );
  useEffect(() => {
    let isMounted = true;
    const fetchServerStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/status`);
        const data = await response.json().catch(() => ({}));
        if (!isMounted) return;
        const status = data.status || (response.ok ? "ok" : "offline");
        setServerStatus({
          status,
          version: data.version || ""
        });
      } catch (error) {
        console.error(error);
        if (!isMounted) return;
        setServerStatus((prev) => ({
          ...prev,
          status: "offline"
        }));
      }
    };

    fetchServerStatus();
    const intervalId = setInterval(fetchServerStatus, 30000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);
  useEffect(() => {
    if (!activeSchoolYearId) return;
    console.info("Active school year updated", {
      activeSchoolYearId,
      activeSchoolYear,
      schoolYears
    });
    logClientEvent("school-year-updated", {
      activeSchoolYearId,
      activeSchoolYear,
      schoolYears
    });
  }, [activeSchoolYear, activeSchoolYearId, schoolYears]);
  const activeModules = useMemo(
    () =>
      (activeSchoolYear?.modules || []).filter(
        (module) => module.schoolYear === activeSchoolYear?.label
      ),
    [activeSchoolYear]
  );
  const e1Students = useMemo(
    () =>
      students.filter(
        (student) =>
          student.moduleId === activeModuleId &&
          getStudentEvaluationType(student) === "E1"
      ),
    [activeModuleId, students]
  );
  const e2Students = useMemo(
    () =>
      students.filter(
        (student) =>
          student.moduleId === activeModuleId &&
          getStudentEvaluationType(student) === "E2"
      ),
    [activeModuleId, students]
  );
  const copySourceStudents = useMemo(
    () =>
      students.filter(
        (student) =>
          student.moduleId === activeModuleId &&
          getStudentEvaluationType(student) === copyConfig.source
      ),
    [activeModuleId, copyConfig.source, students]
  );

  const resetAppState = (nextTeacherId = "") => {
    isHydratedRef.current = false;
    setSchoolYears([]);
    setTemplate(defaultTemplate);
    setActiveSchoolYearId("");
    setActiveModuleId("");
    setActiveEvaluationType(EVALUATION_TYPES[0]);
    setStudents([]);
    setSelectedId("");
    setDraft(buildStudentFromTemplate(defaultTemplate, nextTeacherId));
    setIsEditing(false);
    setLoadError("");
    setIsLoading(false);
  };

  useEffect(() => {
    if (!authToken) {
      resetAppState("");
      return;
    }

    const loadState = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/state`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (response.status === 401) {
          clearStoredAuth();
          setAuthUser(null);
          setAuthToken("");
          setAuthError("Votre session a expiré. Veuillez vous reconnecter.");
          resetAppState("");
          logClientEvent("state-load-unauthorized", {
            status: response.status
          });
          return;
        }
        if (!response.ok) {
          logClientEvent("state-load-error", {
            status: response.status
          });
          throw new Error("Impossible de récupérer les données enregistrées.");
        }
        const data = await response.json();
        setSchoolYears(normalizeSchoolYears(data.schoolYears));
        setStudents(data.students || []);
        logClientEvent("state-loaded", {
          schoolYears: Array.isArray(data.schoolYears)
            ? data.schoolYears.length
            : 0,
          students: Array.isArray(data.students) ? data.students.length : 0,
          hasModules: Array.isArray(data.modules) ? data.modules.length : 0
        });
        setLoadError("");
        isHydratedRef.current = true;
      } catch (error) {
        console.error(error);
        logClientEvent("state-load-exception", {
          message: error?.message || "unknown"
        });
        setLoadError(
          "Impossible de charger les données enregistrées depuis le serveur. Veuillez réessayer."
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadState();
  }, [authToken]);

  useEffect(() => {
    if (!isHydratedRef.current || !isAuthenticated) return;
    const persistState = async () => {
      try {
        await fetch(`${API_BASE_URL}/api/state`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ schoolYears, students })
        });
      } catch (error) {
        console.error(error);
      }
    };

    persistState();
  }, [authToken, isAuthenticated, schoolYears, students]);

  useEffect(() => {
    if (selectedStudent) {
      setDraft(applyTemplateToStudent(template, selectedStudent, teacherId));
      setIsEditing(true);
    } else {
      setDraft(buildStudentFromTemplate(template, teacherId));
      setIsEditing(false);
    }
  }, [selectedStudent, template, teacherId]);

  useEffect(() => {
    if (!teacherName) return;
    setTemplate((prev) =>
      prev.teacher === teacherName ? prev : { ...prev, teacher: teacherName }
    );
  }, [teacherName]);

  useEffect(() => {
    if (template.evaluationType !== activeEvaluationType) return;
    setStudents((prev) =>
      prev.map((student) =>
        student.moduleId === template.moduleId &&
          getStudentEvaluationType(student) === activeEvaluationType
          ? applyTemplateToStudent(template, student, teacherId)
          : student
      )
    );
    setDraft((prev) =>
      prev.moduleId === template.moduleId &&
        getStudentEvaluationType(prev) === activeEvaluationType
        ? applyTemplateToStudent(template, prev, teacherId)
        : prev
    );
  }, [activeEvaluationType, template, teacherId]);

  useEffect(() => {
    if (!schoolYears.length) return;
    if (
      !activeSchoolYearId ||
      !schoolYears.some((year) => year.id === activeSchoolYearId)
    ) {
      setActiveSchoolYearId(schoolYears[0]?.id || "");
    }
  }, [activeSchoolYearId, schoolYears]);

  useEffect(() => {
    if (!activeModules.length) {
      setActiveModuleId("");
      return;
    }
    if (
      !activeModuleId ||
      !activeModules.some((module) => module.id === activeModuleId)
    ) {
      setActiveModuleId(activeModules[0]?.id || "");
    }
  }, [activeModuleId, activeModules]);

  useEffect(() => {
    setSelectedId((prev) => {
      if (moduleStudents.some((student) => student.id === prev)) {
        return prev;
      }
      return moduleStudents[0]?.id || "";
    });
  }, [moduleStudents]);

  useEffect(() => {
    const activeModule = activeModules.find(
      (module) => module.id === activeModuleId
    );
    if (!activeModule || !activeSchoolYear) return;
    setTemplate(
      getModuleTemplate(activeModule, activeSchoolYear.label, activeEvaluationType)
    );
  }, [activeEvaluationType, activeModuleId, activeModules, activeSchoolYear]);

  const activeModule = useMemo(
    () => activeModules.find((module) => module.id === activeModuleId) || null,
    [activeModuleId, activeModules]
  );

  useEffect(() => {
    if (!activeModule) return;
    const availableTypes = getAvailableEvaluationTypes(activeModule);
    if (!availableTypes.includes(activeEvaluationType)) {
      setActiveEvaluationType(availableTypes[0]);
    }
  }, [activeEvaluationType, activeModule]);

  const persistDraftChanges = (updater) => {
    setDraft((prevDraft) => {
      const nextDraft =
        typeof updater === "function" ? updater(prevDraft) : updater;
      const nextWithTeacher = teacherId
        ? { ...nextDraft, teacherId: nextDraft.teacherId || teacherId }
        : nextDraft;

      setStudents((prevStudents) => {
        const exists = prevStudents.some(
          (student) => student.id === nextWithTeacher.id
        );

        if (exists) {
          return prevStudents.map((student) =>
            student.id === nextWithTeacher.id ? { ...nextWithTeacher } : student
          );
        }

        if (!hasStudentIdentity(nextWithTeacher)) {
          return prevStudents;
        }

        return [...prevStudents, { ...nextWithTeacher }];
      });

      if (hasStudentIdentity(nextWithTeacher)) {
        setSelectedId(nextWithTeacher.id);
        setIsEditing(true);
      }

      return nextWithTeacher;
    });
  };

  const templateCompetencyCount = useMemo(
    () => template.competencyOptions?.length || 0,
    [template.competencyOptions]
  );

  const templateTaskCount = useMemo(() => {
    const sections = template.competencies || [];
    return sections.reduce(
      (total, section) => total + (section.items?.length || 0),
      0
    );
  }, [template.competencies]);

  const handleAuthFieldChange = (field, value) => {
    setAuthForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAuthSubmit = async (event) => {
    if (event?.preventDefault) {
      event.preventDefault();
    }
    setAuthError("");
    if (!authForm.email || !authForm.password) {
      setAuthError("Veuillez saisir votre e-mail et votre mot de passe.");
      return;
    }
    if (authMode === "register") {
      if (!authForm.name) {
        setAuthError("Veuillez saisir votre nom.");
        return;
      }
      if (authForm.password !== authForm.confirmPassword) {
        setAuthError("Les mots de passe ne correspondent pas.");
        return;
      }
    }

    const payload =
      authMode === "register"
        ? {
          name: authForm.name,
          email: authForm.email,
          password: authForm.password
        }
        : { email: authForm.email, password: authForm.password };

    try {
      setAuthLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/auth/${authMode === "register" ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      const data = await response.json();
      if (!response.ok) {
        setAuthError(data?.error || "Impossible de vous authentifier.");
        return;
      }
      setAuthUser(data.user);
      setAuthToken(data.token);
      persistStoredAuth({ user: data.user, token: data.token });
      setAuthForm({ name: "", email: "", password: "", confirmPassword: "" });
    } catch (error) {
      console.error(error);
      setAuthError("Impossible de vous authentifier. Veuillez réessayer.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearStoredAuth();
    setAuthUser(null);
    setAuthToken("");
    setAuthMode("login");
    resetAppState("");
  };

  const handleStudentField = (field, value) => {
    persistDraftChanges((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCompetencySummaryOverride = (competencyId, value) => {
    if (!competencyId) return;
    persistDraftChanges((prev) => {
      const overrides = { ...(prev.competencySummaryOverrides || {}) };
      if (!value) {
        delete overrides[competencyId];
      } else {
        overrides[competencyId] = value;
      }
      return {
        ...prev,
        competencySummaryOverrides: overrides
      };
    });
  };

  const syncGroupTask = (sectionIndex, itemIndex, updater) => {
    setDraft((prevDraft) => {
      const nextDraft = updater(prevDraft);
      const groupName = getStudentGroupName(nextDraft);
      const targetSection = nextDraft.competencies?.[sectionIndex] || null;
      const targetItem = targetSection?.items?.[itemIndex] || null;
      const isGroupEvaluation =
        typeof targetItem?.groupEvaluation === "boolean"
          ? targetItem.groupEvaluation
          : Boolean(targetSection?.groupEvaluation);
      const shouldSync =
        template.groupFeatureEnabled &&
        groupName &&
        isGroupEvaluation;

      setStudents((prevStudents) =>
        prevStudents.map((student) => {
          if (student.id === nextDraft.id) {
            return updater(student);
          }
          if (!shouldSync) return student;
          if (student.moduleId !== activeModuleId) return student;
          if (getStudentEvaluationType(student) !== activeEvaluationType) {
            return student;
          }
          if (getStudentGroupName(student) !== groupName) return student;
          return updater(student);
        })
      );

      return nextDraft;
    });
  };

  const updateCompetency = (sectionIndex, itemIndex, field, value) => {
    syncGroupTask(sectionIndex, itemIndex, (student) => ({
      ...student,
      competencies: (student.competencies || []).map((section, sIndex) => {
        if (sIndex !== sectionIndex) return section;
        return {
          ...section,
          items: (section.items || []).map((item, iIndex) =>
            iIndex === itemIndex ? { ...item, [field]: value } : item
          )
        };
      })
    }));
  };

  const updateCategoryResult = (sectionIndex, value) => {
    persistDraftChanges((student) => ({
      ...student,
      competencies: (student.competencies || []).map((section, sIndex) =>
        sIndex === sectionIndex ? { ...section, result: value } : section
      )
    }));
  };

  const handleDeleteStudent = (id) => {
    if (!confirm("Supprimer cet étudiant ?")) return;
    setStudents((prev) => prev.filter((student) => student.id !== id));
    if (selectedId === id) {
      setSelectedId("");
    }
  };

  const handleImportStudents = () => {
    setImportStudentText("");
    setImportStudentError("");
    setIsImportStudentModalOpen(true);
  };

  const handleOpenCopyStudentsModal = (source, target) => {
    const sourceStudents = students.filter(
      (student) =>
        student.moduleId === activeModuleId &&
        getStudentEvaluationType(student) === source
    );
    const defaultSelections = sourceStudents.reduce((acc, student) => {
      const noteValue = Number(student.note);
      const shouldSelect =
        student.note !== "" && Number.isFinite(noteValue) && noteValue < 4;
      acc[student.id] = shouldSelect;
      return acc;
    }, {});
    setCopyConfig({ source, target });
    setCopyStudentSelections(defaultSelections);
    setIsCopyStudentsModalOpen(true);
  };

  const handleToggleCopyStudent = (studentId) => {
    setCopyStudentSelections((prev) => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const handleSelectAllCopyStudents = (nextValue) => {
    setCopyStudentSelections((prev) => {
      const updatedSelections = { ...prev };
      copySourceStudents.forEach((student) => {
        updatedSelections[student.id] = nextValue;
      });
      return updatedSelections;
    });
  };

  const handleConfirmCopyStudents = () => {
    const selectedStudents = copySourceStudents.filter(
      (student) => copyStudentSelections[student.id]
    );
    if (!selectedStudents.length) return;
    const copiedStudents = selectedStudents.map((student) =>
      cloneStudentReport(student, copyConfig.target)
    );
    setStudents((prev) => [...prev, ...copiedStudents]);
    if (
      activeModule &&
      activeSchoolYear &&
      !isEvaluationTypeAvailable(activeModule, copyConfig.target)
    ) {
      const sourceTemplate = getModuleTemplate(
        activeModule,
        activeSchoolYear.label,
        copyConfig.source
      );
      setSchoolYears((prev) =>
        prev.map((year) =>
          year.id === activeSchoolYearId
            ? {
              ...year,
              modules: year.modules.map((module) =>
                module.id === activeModuleId
                  ? {
                    ...module,
                    templates: {
                      ...normalizeModuleTemplates(module, year.label),
                      [copyConfig.target]: normalizeTemplate(
                        sourceTemplate,
                        module,
                        year.label,
                        copyConfig.target
                      )
                    }
                  }
                  : module
              )
            }
            : year
        )
      );
    }
    setActiveEvaluationType(copyConfig.target);
    setIsCopyStudentsModalOpen(false);
  };

  const parseImportLines = (text) => {
    const rows = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!rows.length) return [];

    const headerRow = rows[0].toLowerCase();
    const hasHeader =
      headerRow.includes("nom") && headerRow.includes("prenom");

    const dataRows = hasHeader ? rows.slice(1) : rows;

    return dataRows
      .map((row) => row.split("\t").map((value) => value.trim()))
      .filter((columns) => columns.length >= 2);
  };

  const handleCreateStudentsFromImport = (event) => {
    if (event?.preventDefault) {
      event.preventDefault();
    }

    const rows = parseImportLines(importStudentText);

    if (!rows.length) {
      setImportStudentError(
        "Collez au moins une ligne avec un nom et un prénom."
      );
      return;
    }

    const importedStudents = rows.map(([lastName, firstName, email]) => ({
      ...buildStudentFromTemplate(template, teacherId),
      name: lastName || "",
      firstname: firstName || "",
      email: email || ""
    }));

    setStudents((prev) => [...prev, ...importedStudents]);
    setSelectedId(importedStudents[0]?.id || "");
    setIsEditing(true);
    setIsImportStudentModalOpen(false);
    setImportStudentText("");
    setImportStudentError("");
  };

  const handleGeneratePdf = async () => {
    if (!hasStudentIdentity(draft)) {
      alert("Veuillez saisir le nom de l'étudiant.");
      return;
    }
    const payload = ensureStudentTeacher(draft, template.teacher, teacherName);
    const response = await fetch(`${API_BASE_URL}/api/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      alert("Impossible de générer le PDF.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildReportFilename(draft);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleGenerateCoachingPdf = async () => {
    if (!hasStudentIdentity(draft)) {
      alert("Veuillez saisir le nom de l'étudiant.");
      return;
    }
    if (!shouldIncludeCoaching(draft)) {
      alert(
        "La note de l'étudiant doit être inférieure à 4 pour générer le coaching."
      );
      return;
    }
    const payload = ensureStudentTeacher(draft, template.teacher, teacherName);
    const response = await fetch(`${API_BASE_URL}/api/report/coaching`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      alert("Impossible de générer le PDF de coaching.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildCoachingFilename(draft);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleSubmitMailDraft = async (event) => {
    event.preventDefault();
    setIsMailDraftModalOpen(false);
    await handleExportAllReports();
  };

  const handleExportAllReports = async () => {
    if (moduleStudents.length === 0) {
      alert("Aucun étudiant à exporter.");
      return;
    }
    setIsExporting(true);
    try {
      const studentsWithTeacher = moduleStudents.map((student) =>
        ensureStudentTeacher(student, template.teacher, teacherName)
      );
      const response = await fetch(`${API_BASE_URL}/api/report/export-all`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          students: studentsWithTeacher,
          mailDraftSubject,
          mailDraftBody
        })
      });

      if (!response.ok) {
        alert("Impossible d'exporter les rapports.");
        return;
      }

      const moduleLabel = sanitizeFilename(activeModule?.title || "module");
      const evaluationLabel = sanitizeFilename(activeEvaluationType || "rapport");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${moduleLabel}-${evaluationLabel}-rapports.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const updateTemplate = (updater) => {
    setTemplate((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setSchoolYears((prevYears) =>
        prevYears.map((year) =>
          year.id === activeSchoolYearId
            ? {
              ...year,
              modules: year.modules.map((module) =>
                module.id === activeModuleId
                  ? {
                    ...module,
                    templates: {
                      ...normalizeModuleTemplates(module, year.label),
                      [activeEvaluationType]: normalizeTemplate(
                        next,
                        module,
                        year.label,
                        activeEvaluationType
                      )
                    }
                  }
                  : module
              )
            }
            : year
        )
      );
      return next;
    });
  };

  const handleTemplateField = (field, value) => {
    updateTemplate((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEvaluationTypeChange = (nextType) => {
    setActiveEvaluationType(nextType);
  };

  const handleTemplateCategoryChange = (sectionIndex, value) => {
    updateTemplate((prev) => ({
      ...prev,
      competencies: (prev.competencies || []).map((section, sIndex) =>
        sIndex === sectionIndex ? { ...section, category: value } : section
      )
    }));
  };

  const handleTemplateTaskFieldChange = (
    sectionIndex,
    itemIndex,
    field,
    value
  ) => {
    updateTemplate((prev) => ({
      ...prev,
      competencies: (prev.competencies || []).map((section, sIndex) => {
        if (sIndex !== sectionIndex) return section;
        return {
          ...section,
          items: (section.items || []).map((item, iIndex) => {
            if (iIndex !== itemIndex) return item;
            const normalizedItem = normalizeTemplateItem(
              item,
              section.groupEvaluation ?? false
            );
            return { ...normalizedItem, [field]: value };
          })
        };
      })
    }));
  };

  const handleAddCategory = () => {
    updateTemplate((prev) => ({
      ...prev,
      competencies: [
        ...(prev.competencies || []),
        {
          category: "Nouveau thème",
          groupEvaluation: false,
          items: [
            {
              task: "Nouvelle tâche",
              competencyId: prev.competencyOptions?.[0]?.code || "",
              evaluationMethod: "",
              groupEvaluation: false
            }
          ]
        }
      ]
    }));
  };

  const handleRemoveCategory = (sectionIndex) => {
    updateTemplate((prev) => ({
      ...prev,
      competencies: (prev.competencies || []).filter(
        (_, index) => index !== sectionIndex
      )
    }));
  };

  const handleAddCompetencyOption = () => {
    updateTemplate((prev) => ({
      ...prev,
      competencyOptions: [
        ...(prev.competencyOptions || []),
        {
          code: `OO${(prev.competencyOptions?.length || 0) + 1}`,
          description: "Nouvelle compétence"
        }
      ]
    }));
  };

  const handleCompetencyOptionChange = (index, field, value) => {
    updateTemplate((prev) => ({
      ...prev,
      competencyOptions: (prev.competencyOptions || []).map(
        (option, optIndex) =>
          optIndex === index ? { ...option, [field]: value } : option
      )
    }));
  };

  const handleRemoveCompetencyOption = (index) => {
    updateTemplate((prev) => {
      const removedCode = prev.competencyOptions?.[index]?.code;
      const updatedOptions = (prev.competencyOptions || []).filter(
        (_, optIndex) => optIndex !== index
      );

      return {
        ...prev,
        competencyOptions: updatedOptions,
        competencies: (prev.competencies || []).map((section) => ({
          ...section,
          items: (section.items || []).map((item) => {
            const normalizedItem = normalizeTemplateItem(
              item,
              section.groupEvaluation ?? false
            );
            if (normalizedItem.competencyId === removedCode) {
              return { ...normalizedItem, competencyId: "" };
            }
            return normalizedItem;
          })
        }))
      };
    });
  };

  const handleAddTask = (sectionIndex) => {
    updateTemplate((prev) => ({
      ...prev,
      competencies: (prev.competencies || []).map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
            ...section,
            items: [
              ...(section.items || []),
              {
                task: "Nouvelle tâche",
                competencyId: prev.competencyOptions?.[0]?.code || "",
                evaluationMethod: "",
                groupEvaluation: false
              }
            ]
          }
          : section
      )
    }));
  };

  const handleReorderTask = (sectionIndex, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    updateTemplate((prev) => ({
      ...prev,
      competencies: (prev.competencies || []).map((section, sIndex) => {
        if (sIndex !== sectionIndex) return section;
        const items = [...(section.items || [])];
        if (
          fromIndex < 0 ||
          fromIndex >= items.length ||
          toIndex < 0 ||
          toIndex >= items.length
        ) {
          return section;
        }
        const [moved] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, moved);
        return {
          ...section,
          items
        };
      })
    }));
  };

  const handleTaskDragStart = (sectionIndex, itemIndex) => (event) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", "drag-task");
    setDraggedTask({ sectionIndex, itemIndex });
  };

  const handleTaskDragOver = (sectionIndex, itemIndex) => (event) => {
    if (!draggedTask) return;
    event.preventDefault();
    setDragOverTask({ sectionIndex, itemIndex });
  };

  const handleTaskDrop = (sectionIndex, itemIndex) => (event) => {
    if (!draggedTask) return;
    event.preventDefault();
    if (draggedTask.sectionIndex !== sectionIndex) {
      setDraggedTask(null);
      setDragOverTask(null);
      return;
    }
    handleReorderTask(sectionIndex, draggedTask.itemIndex, itemIndex);
    setDraggedTask(null);
    setDragOverTask(null);
  };

  const handleTaskDragEnd = () => {
    setDraggedTask(null);
    setDragOverTask(null);
  };

  const handleStudentGroupChange = (studentId, value) => {
    setStudents((prev) => {
      let updatedStudent = null;
      const nextStudents = prev.map((student) => {
        if (student.id !== studentId) return student;
        const nextStudent = template.groupFeatureEnabled
          ? syncGroupEvaluations({ ...student, groupName: value }, value, prev)
          : { ...student, groupName: value };
        updatedStudent = nextStudent;
        return nextStudent;
      });

      if (selectedId === studentId && updatedStudent) {
        setDraft(updatedStudent);
      }

      return nextStudents;
    });
  };

  const handleRemoveTask = (sectionIndex, itemIndex) => {
    updateTemplate((prev) => ({
      ...prev,
      competencies: (prev.competencies || []).map((section, sIndex) => {
        if (sIndex !== sectionIndex) return section;
        return {
          ...section,
          items: (section.items || []).filter(
            (_, iIndex) => iIndex !== itemIndex
          )
        };
      })
    }));
  };

  const handleAddModule = () => {
    if (!activeSchoolYear) {
      const fallbackSchoolYear = buildDefaultSchoolYear();
      setSchoolYears((prev) => [...prev, fallbackSchoolYear]);
      setActiveSchoolYearId(fallbackSchoolYear.id);
      setActiveModuleId(fallbackSchoolYear.modules[0]?.id || "");
      return;
    }
    const newModule = buildDefaultModule(
      {
        title: "Nouveau module"
      },
      EMPTY_TEMPLATE,
      activeSchoolYear.label
    );
    setSchoolYears((prev) =>
      prev.map((year) =>
        year.id === activeSchoolYearId
          ? {
            ...year,
            modules: [...year.modules, newModule]
          }
          : year
      )
    );
    setActiveModuleId(newModule.id);
    setActiveEvaluationType(EVALUATION_TYPES[0]);
  };

  const handleModuleFieldChange = (moduleId, field, value) => {
    setSchoolYears((prev) =>
      prev.map((year) =>
        year.id === activeSchoolYearId
          ? {
            ...year,
            modules: year.modules.map((module) => {
              if (module.id !== moduleId) return module;
              const updatedModule = { ...module, [field]: value };
              return {
                ...updatedModule,
                templates: normalizeModuleTemplates(
                  {
                    ...updatedModule,
                    templates: normalizeModuleTemplates(module, year.label)
                  },
                  year.label
                )
              };
            })
          }
          : year
      )
    );
  };

  const handleRemoveModule = (moduleId) => {
    if (!confirm("Supprimer ce module ?")) return;
    setSchoolYears((prev) =>
      prev.map((year) => {
        if (year.id !== activeSchoolYearId) return year;
        const remainingModules = year.modules.filter(
          (module) => module.id !== moduleId
        );
        return {
          ...year,
          modules:
            remainingModules.length > 0
              ? remainingModules
              : [buildDefaultModule({}, EMPTY_TEMPLATE, year.label)]
        };
      })
    );
    if (activeModuleId === moduleId) {
      setActiveModuleId("");
    }
  };

  const handleRemoveReportType = (evaluationType) => {
    if (!activeModule || !activeSchoolYear) return;
    const availableTypes = getAvailableEvaluationTypes(activeModule);
    if (!availableTypes.includes(evaluationType)) return;

    const isLastType = availableTypes.length === 1;
    const confirmMessage = isLastType
      ? "Supprimer ce type de rapport ? C'est le dernier type de rapport et cela supprimera le module entier ainsi que tous les étudiants associés."
      : "Supprimer ce type de rapport et tous les étudiants associés ?";
    if (!confirm(confirmMessage)) return;

    setStudents((prev) =>
      prev.filter((student) => {
        if (student.moduleId !== activeModuleId) return true;
        if (isLastType) return false;
        return getStudentEvaluationType(student) !== evaluationType;
      })
    );

    setSchoolYears((prev) =>
      prev.map((year) => {
        if (year.id !== activeSchoolYearId) return year;
        if (isLastType) {
          return {
            ...year,
            modules: year.modules.filter((module) => module.id !== activeModuleId)
          };
        }
        return {
          ...year,
          modules: year.modules.map((module) => {
            if (module.id !== activeModuleId) return module;
            const templates = { ...(module.templates || {}) };
            delete templates[evaluationType];
            return {
              ...module,
              templates
            };
          })
        };
      })
    );

    if (activeEvaluationType === evaluationType) {
      const remainingTypes = availableTypes.filter(
        (type) => type !== evaluationType
      );
      setActiveEvaluationType(remainingTypes[0] || EVALUATION_TYPES[0]);
    }
  };

  const handleApplyTemplate = () => {
    setStudents((prev) =>
      prev.map((student) =>
        student.moduleId === template.moduleId &&
          getStudentEvaluationType(student) === activeEvaluationType
          ? applyTemplateToStudent(template, student, teacherId)
          : student
      )
    );
    setDraft((prev) =>
      prev.moduleId === template.moduleId &&
        getStudentEvaluationType(prev) === activeEvaluationType
        ? applyTemplateToStudent(template, prev, teacherId)
        : prev
    );
    setIsTemplateModalOpen(false);
  };

  const selectedCopyStudentsCount = useMemo(
    () =>
      copySourceStudents.filter((student) => copyStudentSelections[student.id])
        .length,
    [copyStudentSelections, copySourceStudents]
  );
  const footer = (
    <footer className="app-footer">
      <div className="footer-item">
        <span className={statusIndicatorClass} aria-hidden="true" />
        <span>
          Serveur : {serverStatusLabel} ({API_BASE_URL})
        </span>
      </div>
      <div className="footer-item">Client v{clientVersion}</div>
      <div className="footer-item">Serveur v{serverVersionLabel}</div>
    </footer>
  );

  if (!isAuthenticated) {
    return (
      <div className="app auth-page">
        <header className="hero">
          <div>
            <h1>Connectez-vous pour accéder aux rapports des étudiants</h1>
            <p className="subtitle">
              Chaque enseignant ne voit que ses propres rapports. Créez un
              compte ou connectez-vous pour continuer.
            </p>
          </div>
        </header>

        <main className="layout auth-layout">
          <section className="panel auth-panel">
            <div className="panel-header">
              <h2>
                {authMode === "login" ? "Connexion enseignant" : "Nouveau compte"}
              </h2>
              <span className="helper-text">
                {authMode === "login"
                  ? "Utilisez votre compte enseignant pour accéder aux rapports."
                  : "Créez un compte enseignant pour garder les rapports privés."}
              </span>
            </div>
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authMode === "register" && (
                <label>
                  Nom complet
                  <input
                    type="text"
                    value={authForm.name}
                    onChange={(event) =>
                      handleAuthFieldChange("name", event.target.value)
                    }
                    placeholder="Mme Martin"
                  />
                </label>
              )}
              <label>
                E-mail
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) =>
                    handleAuthFieldChange("email", event.target.value)
                  }
                  placeholder="enseignant@example.com"
                />
              </label>
              <label>
                Mot de passe
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) =>
                    handleAuthFieldChange("password", event.target.value)
                  }
                  placeholder="********"
                />
              </label>
              {authMode === "register" && (
                <label>
                  Confirmer le mot de passe
                  <input
                    type="password"
                    value={authForm.confirmPassword}
                    onChange={(event) =>
                      handleAuthFieldChange("confirmPassword", event.target.value)
                    }
                    placeholder="********"
                  />
                </label>
              )}
              {authError && (
                <p className="helper-text error-text" role="alert">
                  {authError}
                </p>
              )}
              <div className="actions auth-actions">
                <button
                  type="submit"
                  className="button primary"
                  disabled={authLoading}
                >
                  {authLoading
                    ? "Veuillez patienter..."
                    : authMode === "login"
                      ? "Se connecter"
                      : "Créer un compte"}
                </button>
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "register" : "login");
                    setAuthError("");
                  }}
                >
                  {authMode === "login"
                    ? "Créer un nouveau compte"
                    : "Retour à la connexion"}
                </button>
              </div>
            </form>
          </section>

          <section className="panel auth-panel-info">
            <h2>Espaces enseignants privés</h2>
            <p className="helper-text">
              Votre compte garantit que vous seul pouvez voir et modifier vos
              rapports d'étudiants. Utilisez le même identifiant sur n'importe
              quel appareil pour reprendre où vous vous êtes arrêté.
            </p>
            <ul className="auth-benefits">
              <li>Rapports séparés par enseignant.</li>
              <li>Filtrage automatique de votre liste d'étudiants.</li>
              <li>Accès sécurisé pour les exports PDF.</li>
            </ul>
          </section>
        </main>
        {footer}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="app">
        <main className="layout">
          <p className="helper-text">Chargement des données depuis le serveur...</p>
        </main>
        {footer}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <h1>Générateur de rapports d'évaluation</h1>
        </div>
        <div className="hero-card">
          <div>
            <p className="label">Connecté en tant que</p>
            <p className="value">{authUser?.name || authUser?.email}</p>
          </div>
          <button className="button ghost" onClick={handleLogout}>
            Se déconnecter
          </button>
        </div>
      </header>

      <main className="layout">
        {loadError && (
          <p className="helper-text error-text" role="alert">
            {loadError}
          </p>
        )}
        <section className="panel template-panel">
          <div className="panel-header">
            <div>
              <h2>Evaluation</h2>
            </div>
          </div>

          <div className="module-selector">
            <div className="module-selector-fields">
              <label>
                Année scolaire
                <select
                  value={activeSchoolYearId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    const selectedYear = schoolYears.find(
                      (year) => year.id === nextId
                    );
                    console.info("School year changed", {
                      nextId,
                      previousId: activeSchoolYearId,
                      selectedYear,
                      availableYears: schoolYears
                    });
                    logClientEvent("school-year-change", {
                      nextId,
                      previousId: activeSchoolYearId,
                      selectedYear,
                      availableYears: schoolYears
                    });
                    setActiveSchoolYearId(nextId);
                  }}
                >
                  {schoolYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Module actif
                <select
                  value={activeModuleId}
                  onChange={(event) => setActiveModuleId(event.target.value)}
                >
                  {activeModules.map((module) => {
                    const title = module.title || "Module";
                    return (
                      <option key={module.id} value={module.id}>
                        {title}
                      </option>
                    );
                  })}
                </select>
              </label>
              <div className="module-evaluation-group">
                <span className="module-evaluation-title">
                  Type de rapport
                </span>
                <div
                  className="module-evaluation-selector"
                  role="group"
                  aria-label="Type de rapport"
                >
                  {EVALUATION_TYPES.map((type) => {
                    const isAvailable = isEvaluationTypeAvailable(
                      activeModule,
                      type
                    );
                    return (
                      <label key={type} className="module-evaluation-option">
                        <input
                          type="radio"
                          name="module-evaluation-type"
                          value={type}
                          checked={activeEvaluationType === type}
                          onChange={(event) =>
                            handleEvaluationTypeChange(event.target.value)
                          }
                          disabled={!isAvailable}
                        />
                        <span>{type}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="module-actions-row">
              <div className="module-actions">
                <button
                  className="button ghost"
                  onClick={() => handleOpenCopyStudentsModal("E1", "E2")}
                  disabled={e1Students.length === 0}
                  title={
                    e1Students.length === 0
                      ? "Aucun étudiant en E1 à copier."
                      : "Copier les rapports E1 vers E2"
                  }
                >
                  Copier E1 → E2
                </button>
                <button
                  className="button ghost"
                  onClick={() => handleOpenCopyStudentsModal("E2", "E3")}
                  disabled={e2Students.length === 0}
                  title={
                    e2Students.length === 0
                      ? "Aucun étudiant en E2 à copier."
                      : "Copier les rapports E2 vers E3"
                  }
                >
                  Copier E2 → E3
                </button>
                <button
                  className="button danger"
                  type="button"
                  onClick={() => handleRemoveReportType(activeEvaluationType)}
                  disabled={
                    !isEvaluationTypeAvailable(
                      activeModule,
                      activeEvaluationType
                    )
                  }
                >
                  Supprimer le rapport {activeEvaluationType}
                </button>
              </div>
              <div className="actions module-template-actions">
                <button
                  className="button ghost"
                  type="button"
                  onClick={() => setIsMailDraftModalOpen(true)}
                  disabled={moduleStudents.length === 0 || isExporting}
                  title={
                    moduleStudents.length === 0
                      ? "Aucun étudiant à exporter."
                      : "Exporter tous les rapports pour ce module et ce type de rapport"
                  }
                >
                  {isExporting ? "Export en cours..." : "Générer les rapports"}
                </button>
                <button
                  className="button primary"
                  type="button"
                  onClick={() => setIsTemplateModalOpen(true)}
                >
                  Modifier le modèle
                </button>
                <button className="button primary" onClick={handleAddModule}>
                  Nouveau module
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Liste des étudiants</h2>
            <div className="actions">
              <button className="button ghost" onClick={handleImportStudents}>
                Importer des étudiants
              </button>
            </div>
          </div>
          {template.groupFeatureEnabled && (
            <div className="group-controls">
              <p className="helper-text">
                Attribuez les étudiants à un groupe pour partager les résultats
                des thèmes évalués en groupe.
              </p>
              <datalist id="group-options">
                {groupOptions.map((groupName) => (
                  <option key={groupName} value={groupName} />
                ))}
              </datalist>
            </div>
          )}
          <table className="student-table">
            <thead>
              <tr>
                <th>Nom prénom</th>
                <th className="student-note-header">Note</th>
              </tr>
            </thead>
            <tbody>
              {moduleStudents.length === 0 && (
                <tr className="empty">
                  <td colSpan={2}>
                    Aucun étudiant pour ce module. Importez une liste pour
                    démarrer.
                  </td>
                </tr>
              )}
              {moduleStudents.map((student) => (
                <tr
                  key={student.id}
                  className={[
                    "student-row",
                    getStudentNoteClass(student.note),
                    selectedId === student.id ? "active" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSelectedId(student.id)}
                >
                  <td>
                    <p className="student-name">
                      {getStudentDisplayName(student) || "Étudiant sans nom"}
                    </p>
                    {template.groupFeatureEnabled && (
                      <p className="student-meta">
                        {getStudentGroupName(student)
                          ? `Groupe : ${getStudentGroupName(student)}`
                          : "Aucun groupe attribué"}
                      </p>
                    )}
                    {template.groupFeatureEnabled && (
                      <div
                        className="student-group-field"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <label>
                          Groupe
                          <input
                            type="text"
                            list="group-options"
                            value={student.groupName || ""}
                            onChange={(event) =>
                              handleStudentGroupChange(
                                student.id,
                                event.target.value
                              )
                            }
                            placeholder="Groupe A"
                          />
                        </label>
                      </div>
                    )}
                  </td>
                  <td className="student-note-cell">
                    <div className="student-note-content">
                      <span className="student-note-value">
                        {student.note || "—"}
                      </span>
                      <button
                        className="button text"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteStudent(student.id);
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {moduleStudents.length > 0 && (
                <tr className="student-summary-row">
                  <td colSpan={2}>
                    <div className="student-summary">
                      <span>
                        Réussite : {moduleStats.successCount} (
                        {moduleStats.successPercent}%)
                      </span>
                      <span>
                        Échec : {moduleStats.failureCount} (
                        {moduleStats.failurePercent}%)
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="panel form-panel">
          <div className="panel-header">
            <h2>
              {isEditing
                ? getStudentDisplayName(draft) || "Modifier le rapport"
                : "Nouveau rapport"}
            </h2>
            <div className="actions">
              <button className="button primary" onClick={handleGeneratePdf}>
                Générer le rapport
              </button>
              {shouldIncludeCoaching(draft) && (
                <button
                  className="button ghost"
                  type="button"
                  onClick={handleGenerateCoachingPdf}
                >
                  Générer la demande de coaching
                </button>
              )}
            </div>
          </div>

          <div className="details-toggle-row">
            <button
              type="button"
              className="button ghost details-toggle"
              onClick={() => setShowDetails((prev) => !prev)}
              aria-expanded={showDetails}
            >
              {showDetails ? "Masquer les détails" : "Afficher les détails"}
            </button>
          </div>
          {showDetails && (
            <div className="form-grid details-grid">
              <label>
                Nom
                <input
                  type="text"
                  value={draft.name}
                  readOnly
                  placeholder="Dupont"
                />
              </label>
              <label>
                Prénom
                <input
                  type="text"
                  value={draft.firstname}
                  readOnly
                  placeholder="Jeanne"
                />
              </label>
              <label>
                E-mail
                <input
                  type="email"
                  value={draft.email}
                  readOnly
                  placeholder="student@example.com"
                />
              </label>
              <label>
                Année scolaire
                <input
                  type="text"
                  value={draft.schoolYear}
                  readOnly
                  disabled
                  placeholder="2025-2026"
                />
              </label>
              <label>
                Type d'évaluation
                <input
                  type="text"
                  value={draft.evaluationType}
                  readOnly
                  disabled
                  placeholder="E1, E2 ou E3"
                />
              </label>
              <label>
                Classe
                <input
                  type="text"
                  value={draft.className}
                  readOnly
                  disabled
                  placeholder="Classe définie dans le modèle"
                />
              </label>
              <label>
                Enseignant
                <input
                  type="text"
                  value={draft.teacher}
                  readOnly
                  disabled
                  placeholder="Enseignant défini dans le modèle"
                />
              </label>
              <label>
                Date d'évaluation
                <input
                  type="date"
                  value={draft.evaluationDate}
                  readOnly
                  disabled
                />
              </label>
              <label>
                Date de coaching
                <input
                  type="date"
                  value={draft.coachingDate}
                  readOnly
                  disabled
                />
              </label>
              <label>
                Titre du module
                <input
                  type="text"
                  value={draft.moduleTitle}
                  readOnly
                  disabled
                />
              </label>
              <label>
                Compétence opérationnelle
                <input
                  type="text"
                  value={draft.operationalCompetence}
                  readOnly
                  disabled
                  placeholder="Définie dans le modèle"
                />
              </label>
            </div>
          )}

          <div className="textarea-block">
            <label>
              Remarques de l'enseignant
              <textarea
                rows="3"
                value={draft.remarks}
                onChange={(event) =>
                  handleStudentField("remarks", event.target.value)
                }
                placeholder="Notes supplémentaires, plan de remédiation, etc."
              />
            </label>
          </div>

          <div className="report-summary">
            <div className="report-summary-header">
              <h3>Résumé</h3>
              <p className="helper-text">
                Aperçu des thèmes et des résultats (lecture seule).
              </p>
            </div>
            {(draft.competencies || []).length ? (
              <table className="report-summary-table">
                <thead>
                  <tr>
                    <th scope="col">
                      {draft.summaryByCompetencies ? "Compétence" : "Thème"}
                    </th>
                    <th scope="col">Résultat</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row, rowIndex) => {
                    const override = draft.summaryByCompetencies
                      ? draft.competencySummaryOverrides?.[row.competencyId] || ""
                      : "";
                    const effectiveResult = override || row.result || "";
                    const statusClass = getStatusClass(effectiveResult);
                    return (
                      <tr
                        key={`${row.label}-${rowIndex}`}
                        className={`report-summary-row ${statusClass}`}
                      >
                        <td className="summary-category">
                          {row.label || "—"}
                        </td>
                        <td className="summary-result">
                          {draft.summaryByCompetencies ? (
                            <select
                              className={`status-select summary-status-select ${statusClass}`}
                              value={override}
                              onChange={(event) =>
                                handleCompetencySummaryOverride(
                                  row.competencyId,
                                  event.target.value
                                )
                              }
                              aria-label={`Résultat de ${row.label}`}
                            >
                              <option value="">
                                {`Auto (calculé : ${row.result || "—"})`}
                              </option>
                              <option value={STATUS_VALUES.OK}>OK</option>
                              <option value={STATUS_VALUES.NEEDS_IMPROVEMENT}>
                                ~
                              </option>
                              <option value={STATUS_VALUES.NOT_ASSESSED}>
                                NOK
                              </option>
                            </select>
                          ) : (
                            <span className="summary-result-value">
                              {row.result || "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="report-summary-note-row">
                    <td className="summary-category summary-note-spacer">
                      &nbsp;
                    </td>
                    <td
                      className={`summary-result summary-note-cell ${getStudentNoteClass(
                        draft.note
                      )}`}
                    >
                      <span className="summary-note-label">Note du module</span>
                      <select
                        className="summary-note-select"
                        value={draft.note}
                        onChange={(event) =>
                          handleStudentField("note", event.target.value)
                        }
                        aria-label="Note du module"
                      >
                        <option value="">Sélectionner une note</option>
                        {[6, 5, 4, 3, 2, 1].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="helper-text">Aucun thème pour l'instant.</p>
            )}
          </div>

          <div className="competency-grid">
            {(draft.competencies || []).map((section, sectionIndex) => (
              <div key={section.category} className="competency-section">
                <div className="competency-section-header">
                  <label className="category-result">
                    <select
                      className={`status-select ${getStatusClass(section.result)}`}
                      value={section.result}
                      aria-label="Résultat du thème"
                      onChange={(event) =>
                        updateCategoryResult(sectionIndex, event.target.value)
                      }
                    >
                      <option value="">Sélectionner un résultat</option>
                      <option value={STATUS_VALUES.OK}>OK</option>
                      <option value={STATUS_VALUES.NEEDS_IMPROVEMENT}>~</option>
                      <option value={STATUS_VALUES.NOT_ASSESSED}>NOK</option>
                    </select>
                  </label>
                  <h3>{section.category}</h3>
                </div>
                <div className="competency-table">
                  {(section.items || []).map((item, itemIndex) => {
                    const competencyLabel = getCompetencyLabel(
                      item,
                      draft.competencyOptions
                    );
                    const taskLabel = item.task || item.label || "Tâche";
                    const statusClass = getStatusClass(item.status);

                    return (
                      <div
                        key={`${item.task}-${itemIndex}`}
                        className={`competency-row ${statusClass}`}
                      >
                        <div>
                          <p className="competency-label">{taskLabel}</p>
                          <div className="competency-meta-row">
                            <p className="competency-tag">
                              {competencyLabel || "Aucune compétence liée"}
                            </p>
                          </div>
                          <input
                            type="text"
                            value={item.comment}
                            onChange={(event) =>
                              updateCompetency(
                                sectionIndex,
                                itemIndex,
                                "comment",
                                event.target.value
                              )
                            }
                            placeholder="Commentaire facultatif"
                          />
                        </div>
                        <select
                          className={`status-select ${statusClass}`}
                          value={item.status}
                          onChange={(event) =>
                            updateCompetency(
                              sectionIndex,
                              itemIndex,
                              "status",
                              event.target.value
                            )
                          }
                        >
                          <option value="">Sélectionner un statut</option>
                          <option value={STATUS_VALUES.OK}>OK</option>
                          <option value={STATUS_VALUES.NEEDS_IMPROVEMENT}>~</option>
                          <option value={STATUS_VALUES.NOT_ASSESSED}>NOK</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {isImportStudentModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal modal--compact">
            <div className="modal-header">
              <div>
                <h2>Importer des étudiants</h2>
                <p className="helper-text">
                  Collez des lignes depuis Excel avec les colonnes : nom, prénom, email.
                </p>
              </div>
              <button
                className="button ghost"
                onClick={() => setIsImportStudentModalOpen(false)}
              >
                Fermer
              </button>
            </div>
            <form onSubmit={handleCreateStudentsFromImport}>
              <label>
                Liste d'étudiants
                <textarea
                  rows="6"
                  value={importStudentText}
                  onChange={(event) => {
                    setImportStudentText(event.target.value);
                    setImportStudentError("");
                  }}
                  placeholder="nom	prenom	email"
                  autoFocus
                />
              </label>
              {importStudentError && (
                <p className="helper-text error-text">{importStudentError}</p>
              )}
              <div className="actions align-start modal-actions">
                <div className="action-row">
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => setIsImportStudentModalOpen(false)}
                  >
                    Annuler
                  </button>
                  <button type="submit" className="button primary">
                    Importer des étudiants
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCopyStudentsModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal modal--compact">
            <div className="modal-header">
              <div>
                <h2>
                  Copier les rapports {copyConfig.source} vers {copyConfig.target}
                </h2>
                <p className="helper-text">
                  Sélectionnez les étudiants à copier. Les notes sous 4 sont pré-sélectionnées.
                </p>
              </div>
              <button
                className="button ghost"
                onClick={() => setIsCopyStudentsModalOpen(false)}
              >
                Fermer
              </button>
            </div>
            <div className="copy-students-controls">
              <button
                type="button"
                className="button ghost"
                onClick={() => handleSelectAllCopyStudents(true)}
              >
                Tout sélectionner
              </button>
              <button
                type="button"
                className="button ghost"
                onClick={() => handleSelectAllCopyStudents(false)}
              >
                Tout désélectionner
              </button>
              <span className="helper-text">
                {selectedCopyStudentsCount} sur {copySourceStudents.length} sélectionnés
              </span>
            </div>
            <div className="copy-students-list">
              {copySourceStudents.map((student) => {
                const displayName =
                  getStudentDisplayName(student) || "Étudiant sans nom";
                const noteLabel = student.note ? `Note : ${student.note}` : "Aucune note";
                return (
                  <label key={student.id} className="copy-student-row">
                    <input
                      type="checkbox"
                      checked={Boolean(copyStudentSelections[student.id])}
                      onChange={() => handleToggleCopyStudent(student.id)}
                    />
                    <span>
                      <strong>{displayName}</strong>
                      <span className="copy-student-meta">{noteLabel}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="actions align-start modal-actions">
              <div className="action-row">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setIsCopyStudentsModalOpen(false)}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="button primary"
                  onClick={handleConfirmCopyStudents}
                  disabled={selectedCopyStudentsCount === 0}
                >
                  {selectedCopyStudentsCount > 0
                    ? `Copier ${selectedCopyStudentsCount} rapport${selectedCopyStudentsCount === 1 ? "" : "s"
                    }`
                    : "Copier les rapports"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isMailDraftModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal modal--compact">
            <div className="modal-header">
              <div>
                <h2>Préparer le brouillon de mail</h2>
                <p className="helper-text">
                  Indiquez l'objet et le corps du message pour le partager aux étudiants.
                </p>
              </div>
              <button
                className="button ghost"
                onClick={() => setIsMailDraftModalOpen(false)}
              >
                Fermer
              </button>
            </div>
            <form onSubmit={handleSubmitMailDraft}>
              <label>
                Objet
                <input
                  type="text"
                  value={mailDraftSubject}
                  onChange={(event) => setMailDraftSubject(event.target.value)}
                  placeholder="Vos rapports d'évaluation"
                  autoFocus
                />
              </label>
              <label>
                Corps du message
                <textarea
                  rows="6"
                  value={mailDraftBody}
                  onChange={(event) => setMailDraftBody(event.target.value)}
                  placeholder="Bonjour, vous trouverez en pièce jointe vos rapports d'évaluation."
                />
              </label>
              <div className="actions align-start modal-actions">
                <div className="action-row">
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => setIsMailDraftModalOpen(false)}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="button primary"
                    disabled={isExporting}
                  >
                    {isExporting ? "Export en cours..." : "Générer les rapports"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {isTemplateModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2>Modifier le modèle</h2>
                <p className="helper-text">
                  Modifiez les informations du module et les compétences par défaut pour les nouveaux rapports.
                </p>
              </div>
              <button
                className="button ghost"
                onClick={() => setIsTemplateModalOpen(false)}
              >
                Fermer
              </button>
            </div>

            <div className="template-competency-grid">
              <div className="template-competency">
                <div className="template-competency-header">
                  <div className="category-name">
                    <span className="badge">Module actif</span>
                    <p className="helper-text">
                      Mettez à jour les informations du module utilisées dans le modèle actif.
                    </p>
                  </div>
                </div>
                {activeModule ? (
                  <>
                    <div className="form-grid">
                      <label>
                        Titre du module
                        <input
                          type="text"
                          value={activeModule.title}
                          onChange={(event) =>
                            handleModuleFieldChange(
                              activeModule.id,
                              "title",
                              event.target.value
                            )
                          }
                          placeholder="123 - Activer les services d'un serveur"
                        />
                      </label>
                      <label>
                        Année scolaire
                        <input
                          type="text"
                          value={activeSchoolYear?.label || "Non défini"}
                          readOnly
                          disabled
                        />
                      </label>
                    </div>
                    <div className="module-evaluations">
                      {EVALUATION_TYPES.map((type) => (
                        <span key={type} className="module-chip">
                          {type}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="helper-text">
                    Aucun module actif sélectionné.
                  </p>
                )}
              </div>
            </div>

            <div className="form-grid">
              <label>
                Résumé par défaut
                <textarea
                  rows="2"
                  value={template.note}
                  onChange={(event) =>
                    handleTemplateField("note", event.target.value)
                  }
                  placeholder="Texte qui apparaîtra dans le résumé des nouveaux rapports."
                />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Type d'évaluation
                <select
                  value={activeEvaluationType}
                  onChange={(event) =>
                    handleEvaluationTypeChange(event.target.value)
                  }
                >
                  {EVALUATION_TYPES.map((type) => (
                    <option
                      key={type}
                      value={type}
                      disabled={!isEvaluationTypeAvailable(activeModule, type)}
                    >
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="checkbox-field">
                <span>Activer les évaluations de groupe</span>
                <input
                  type="checkbox"
                  checked={template.groupFeatureEnabled}
                  onChange={(event) =>
                    handleTemplateField("groupFeatureEnabled", event.target.checked)
                  }
                />
                <span className="helper-text">
                  Autoriser les thèmes à être partagés entre les étudiants du même groupe.
                </span>
              </label>
              <label className="checkbox-field">
                <span>Résumé par compétences</span>
                <input
                  type="checkbox"
                  checked={template.summaryByCompetencies}
                  onChange={(event) =>
                    handleTemplateField(
                      "summaryByCompetencies",
                      event.target.checked
                    )
                  }
                />
                <span className="helper-text">
                  Afficher les compétences plutôt que les thèmes dans le résumé.
                </span>
              </label>
              <label>
                Classe
                <input
                  type="text"
                  value={template.className}
                  onChange={(event) =>
                    handleTemplateField("className", event.target.value)
                  }
                  placeholder="INFO-F12, LOG-B21..."
                />
              </label>
              <label>
                Enseignant
                <input
                  type="text"
                  value={teacherName}
                  readOnly
                  disabled
                  placeholder="Enseignant connecté"
                />
              </label>
              <label>
                Date d'évaluation
                <input
                  type="date"
                  value={template.evaluationDate}
                  onChange={(event) =>
                    handleTemplateField("evaluationDate", event.target.value)
                  }
                />
              </label>
              <label>
                Date de coaching
                <input
                  type="date"
                  value={template.coachingDate}
                  onChange={(event) =>
                    handleTemplateField("coachingDate", event.target.value)
                  }
                />
              </label>
              <label>
                Compétence opérationnelle
                <input
                  type="text"
                  value={template.operationalCompetence}
                  onChange={(event) =>
                    handleTemplateField("operationalCompetence", event.target.value)
                  }
                  placeholder="OP1, OP2, etc."
                />
              </label>
            </div>

            <div className="template-competency-grid">
              <div className="template-competency">
                <div className="template-competency-header">
                  <div className="category-name">
                    <span className="badge">Liste des compétences</span>
                    <p className="helper-text">
                      Configurez les compétences numérotées disponibles pour chaque tâche.
                    </p>
                  </div>
                  <button
                    className="button ghost"
                    onClick={handleAddCompetencyOption}
                  >
                    + Ajouter une compétence
                  </button>
                </div>
                <div className="template-tasks">
                  {template.competencyOptions?.map((option, index) => (
                    <div key={index} className="template-task-row">
                      <input
                        type="text"
                        value={option.code}
                        onChange={(event) =>
                          handleCompetencyOptionChange(
                            index,
                            "code",
                            event.target.value
                          )
                        }
                        placeholder="OO1"
                      />
                      <textarea
                        rows="2"
                        value={option.description}
                        onChange={(event) =>
                          handleCompetencyOptionChange(
                            index,
                            "description",
                            event.target.value
                          )
                        }
                        placeholder="Définir la configuration..."
                      />
                      <button
                        className="button text"
                        onClick={() => handleRemoveCompetencyOption(index)}
                        aria-label="Supprimer la compétence"
                      >
                        Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="template-competency-grid">
              {(template.competencies || []).map((section, sectionIndex) => (
                <div key={sectionIndex} className="template-competency">
                  <div className="template-competency-header">
                    <div className="category-name">
                      <span className="badge">Thème</span>
                      <input
                        type="text"
                        className="category-input"
                        value={section.category}
                        onChange={(event) =>
                          handleTemplateCategoryChange(
                            sectionIndex,
                            event.target.value
                          )
                        }
                      />
                    </div>
                    <button
                      className="button text"
                      onClick={() => handleRemoveCategory(sectionIndex)}
                      aria-label="Supprimer le thème"
                    >
                      Supprimer
                    </button>
                  </div>
                  <div className="template-tasks">
                    {section.items.map((item, itemIndex) => {
                      const normalizedItem = normalizeTemplateItem(
                        item,
                        section.groupEvaluation ?? false
                      );
                      return (
                        <div
                          key={itemIndex}
                          className={`template-task-row template-task-row--task${dragOverTask?.sectionIndex === sectionIndex &&
                            dragOverTask?.itemIndex === itemIndex
                            ? " is-drag-over"
                            : ""
                            }`}
                          onDragOver={handleTaskDragOver(sectionIndex, itemIndex)}
                          onDrop={handleTaskDrop(sectionIndex, itemIndex)}
                        >
                          <input
                            type="text"
                            value={normalizedItem.task}
                            onChange={(event) =>
                              handleTemplateTaskFieldChange(
                                sectionIndex,
                                itemIndex,
                                "task",
                                event.target.value
                              )
                            }
                          />
                          <select
                            value={normalizedItem.competencyId}
                            onChange={(event) =>
                              handleTemplateTaskFieldChange(
                                sectionIndex,
                                itemIndex,
                                "competencyId",
                                event.target.value
                              )
                            }
                          >
                            <option value="">Sélectionner une compétence</option>
                            {template.competencyOptions?.map((option) => (
                              <option key={option.code} value={option.code}>
                                {option.code}
                              </option>
                            ))}
                          </select>
                          <select
                            value={normalizedItem.evaluationMethod}
                            onChange={(event) =>
                              handleTemplateTaskFieldChange(
                                sectionIndex,
                                itemIndex,
                                "evaluationMethod",
                                event.target.value
                              )
                            }
                          >
                            <option value="">Sélectionner une évaluation</option>
                            {TASK_EVALUATION_METHODS.map((method) => (
                              <option key={method.value} value={method.value}>
                                {method.label}
                              </option>
                            ))}
                          </select>
                          <label className="task-group-toggle">
                            <input
                              type="checkbox"
                              checked={Boolean(normalizedItem.groupEvaluation)}
                              onChange={(event) =>
                                handleTemplateTaskFieldChange(
                                  sectionIndex,
                                  itemIndex,
                                  "groupEvaluation",
                                  event.target.checked
                                )
                              }
                              disabled={!template.groupFeatureEnabled}
                            />
                            Groupe
                          </label>
                          <button
                            className="button text"
                            onClick={() =>
                              handleRemoveTask(sectionIndex, itemIndex)
                            }
                            aria-label="Supprimer la tâche"
                          >
                            Supprimer
                          </button>
                          <a
                            href="#"
                            className="task-drag-handle"
                            role="button"
                            draggable
                            onClick={(event) => event.preventDefault()}
                            onDragStart={handleTaskDragStart(sectionIndex, itemIndex)}
                            onDragEnd={handleTaskDragEnd}
                            aria-label="Réorganiser la tâche"
                          >
                            ⠿
                          </a>
                        </div>
                      );
                    })}
                    <button
                      className="button ghost"
                      onClick={() => handleAddTask(sectionIndex)}
                    >
                      + Ajouter une tâche
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="actions align-start modal-actions">
              <div className="action-row">
                <button className="button ghost" onClick={handleAddCategory}>
                  + Ajouter un thème
                </button>
                <button className="button primary" onClick={handleApplyTemplate}>
                  Appliquer à tous les rapports
                </button>
              </div>
              <p className="helper-text">
                L'application mettra à jour chaque rapport d'étudiant existant avec
                les dernières valeurs du modèle.
              </p>
            </div>
          </div>
        </div>
      )}
      {footer}
    </div>
  );
}

export default App;
