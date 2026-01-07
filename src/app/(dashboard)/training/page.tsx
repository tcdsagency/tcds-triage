"use client";

import { useState } from "react";
import {
  BookOpen,
  Award,
  Star,
  Trophy,
  CheckCircle2,
  Lock,
  Play,
  Clock,
  Target,
  TrendingUp,
  ChevronRight,
  Zap,
  Shield,
  Home,
  Car,
  Users,
  Phone,
  FileText,
  AlertTriangle,
  GraduationCap,
  Medal,
  Flame,
} from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

interface TrainingModule {
  id: string;
  title: string;
  description: string;
  duration: number; // minutes
  xpReward: number;
  type: "video" | "interactive" | "quiz" | "simulation";
  completed: boolean;
  locked: boolean;
  progress?: number;
}

interface SkillCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  modules: TrainingModule[];
  mastery: number; // 0-100
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  earned: boolean;
  earnedDate?: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

// =============================================================================
// DATA
// =============================================================================

const SKILL_CATEGORIES: SkillCategory[] = [
  {
    id: "fundamentals",
    name: "Insurance Fundamentals",
    icon: <BookOpen className="h-5 w-5" />,
    color: "bg-blue-500",
    mastery: 75,
    modules: [
      {
        id: "fund-1",
        title: "Insurance Basics 101",
        description: "Core concepts of insurance - risk, premium, coverage",
        duration: 20,
        xpReward: 100,
        type: "video",
        completed: true,
        locked: false,
      },
      {
        id: "fund-2",
        title: "Policy Structure",
        description: "Declarations, conditions, exclusions, endorsements",
        duration: 25,
        xpReward: 150,
        type: "interactive",
        completed: true,
        locked: false,
      },
      {
        id: "fund-3",
        title: "Claims Process Overview",
        description: "How claims work from FNOL to settlement",
        duration: 30,
        xpReward: 200,
        type: "video",
        completed: true,
        locked: false,
      },
      {
        id: "fund-4",
        title: "Underwriting Fundamentals",
        description: "Risk assessment and pricing basics",
        duration: 35,
        xpReward: 250,
        type: "interactive",
        completed: false,
        locked: false,
        progress: 45,
      },
      {
        id: "fund-5",
        title: "Fundamentals Certification",
        description: "Test your knowledge of insurance basics",
        duration: 20,
        xpReward: 500,
        type: "quiz",
        completed: false,
        locked: true,
      },
    ],
  },
  {
    id: "auto",
    name: "Auto Insurance",
    icon: <Car className="h-5 w-5" />,
    color: "bg-green-500",
    mastery: 60,
    modules: [
      {
        id: "auto-1",
        title: "Auto Coverage Types",
        description: "Liability, collision, comprehensive, PIP, UM/UIM",
        duration: 30,
        xpReward: 200,
        type: "interactive",
        completed: true,
        locked: false,
      },
      {
        id: "auto-2",
        title: "Rating Factors",
        description: "How auto premiums are calculated",
        duration: 25,
        xpReward: 175,
        type: "video",
        completed: true,
        locked: false,
      },
      {
        id: "auto-3",
        title: "SR-22 & High Risk",
        description: "Handling non-standard auto insurance",
        duration: 20,
        xpReward: 150,
        type: "video",
        completed: false,
        locked: false,
      },
      {
        id: "auto-4",
        title: "Auto Claims Handling",
        description: "First notice of loss to settlement",
        duration: 35,
        xpReward: 250,
        type: "simulation",
        completed: false,
        locked: false,
      },
      {
        id: "auto-5",
        title: "Auto Expert Certification",
        description: "Prove your auto insurance mastery",
        duration: 25,
        xpReward: 600,
        type: "quiz",
        completed: false,
        locked: true,
      },
    ],
  },
  {
    id: "home",
    name: "Home Insurance",
    icon: <Home className="h-5 w-5" />,
    color: "bg-purple-500",
    mastery: 40,
    modules: [
      {
        id: "home-1",
        title: "Homeowners Coverage Forms",
        description: "HO-1 through HO-8 and when to use each",
        duration: 35,
        xpReward: 225,
        type: "interactive",
        completed: true,
        locked: false,
      },
      {
        id: "home-2",
        title: "Dwelling vs Personal Property",
        description: "Coverage A, B, C, and D explained",
        duration: 25,
        xpReward: 175,
        type: "video",
        completed: true,
        locked: false,
      },
      {
        id: "home-3",
        title: "Flood & Earthquake",
        description: "Specialty coverages and limitations",
        duration: 30,
        xpReward: 200,
        type: "video",
        completed: false,
        locked: false,
      },
      {
        id: "home-4",
        title: "Home Claims Scenarios",
        description: "Practice handling property claims",
        duration: 40,
        xpReward: 300,
        type: "simulation",
        completed: false,
        locked: true,
      },
    ],
  },
  {
    id: "sales",
    name: "Sales & Service",
    icon: <Users className="h-5 w-5" />,
    color: "bg-orange-500",
    mastery: 85,
    modules: [
      {
        id: "sales-1",
        title: "Building Rapport",
        description: "Connecting with customers in seconds",
        duration: 20,
        xpReward: 150,
        type: "video",
        completed: true,
        locked: false,
      },
      {
        id: "sales-2",
        title: "Needs Discovery",
        description: "Asking the right questions",
        duration: 25,
        xpReward: 175,
        type: "interactive",
        completed: true,
        locked: false,
      },
      {
        id: "sales-3",
        title: "Objection Handling",
        description: "Overcoming price and coverage concerns",
        duration: 30,
        xpReward: 200,
        type: "simulation",
        completed: true,
        locked: false,
      },
      {
        id: "sales-4",
        title: "Cross-Selling Mastery",
        description: "Identifying and presenting opportunities",
        duration: 25,
        xpReward: 250,
        type: "interactive",
        completed: true,
        locked: false,
      },
      {
        id: "sales-5",
        title: "Retention Strategies",
        description: "Keeping customers when they shop",
        duration: 30,
        xpReward: 225,
        type: "video",
        completed: false,
        locked: false,
        progress: 60,
      },
    ],
  },
  {
    id: "systems",
    name: "Systems & Tools",
    icon: <Phone className="h-5 w-5" />,
    color: "bg-cyan-500",
    mastery: 55,
    modules: [
      {
        id: "sys-1",
        title: "TCDS Navigation",
        description: "Master the dashboard and workflows",
        duration: 15,
        xpReward: 100,
        type: "interactive",
        completed: true,
        locked: false,
      },
      {
        id: "sys-2",
        title: "Quote System Deep Dive",
        description: "Efficient quoting techniques",
        duration: 25,
        xpReward: 175,
        type: "interactive",
        completed: true,
        locked: false,
      },
      {
        id: "sys-3",
        title: "Carrier Portals",
        description: "Navigating top carrier systems",
        duration: 40,
        xpReward: 300,
        type: "video",
        completed: false,
        locked: false,
      },
      {
        id: "sys-4",
        title: "Call Handling Tools",
        description: "Using AI assist and call features",
        duration: 20,
        xpReward: 150,
        type: "interactive",
        completed: false,
        locked: false,
      },
    ],
  },
  {
    id: "compliance",
    name: "Compliance & Ethics",
    icon: <Shield className="h-5 w-5" />,
    color: "bg-red-500",
    mastery: 90,
    modules: [
      {
        id: "comp-1",
        title: "E&O Prevention",
        description: "Avoiding errors and omissions",
        duration: 30,
        xpReward: 300,
        type: "video",
        completed: true,
        locked: false,
      },
      {
        id: "comp-2",
        title: "Privacy & Data Security",
        description: "Handling sensitive customer information",
        duration: 25,
        xpReward: 250,
        type: "interactive",
        completed: true,
        locked: false,
      },
      {
        id: "comp-3",
        title: "Anti-Fraud Awareness",
        description: "Detecting and reporting fraud",
        duration: 20,
        xpReward: 200,
        type: "video",
        completed: true,
        locked: false,
      },
      {
        id: "comp-4",
        title: "Annual Compliance Review",
        description: "Required annual certification",
        duration: 45,
        xpReward: 500,
        type: "quiz",
        completed: true,
        locked: false,
      },
    ],
  },
];

const BADGES: Badge[] = [
  {
    id: "first-steps",
    name: "First Steps",
    description: "Complete your first training module",
    icon: <Star className="h-6 w-6" />,
    earned: true,
    earnedDate: "2024-01-15",
    rarity: "common",
  },
  {
    id: "quick-learner",
    name: "Quick Learner",
    description: "Complete 5 modules in one day",
    icon: <Zap className="h-6 w-6" />,
    earned: true,
    earnedDate: "2024-01-22",
    rarity: "rare",
  },
  {
    id: "fundamentals-master",
    name: "Fundamentals Master",
    description: "Achieve 100% mastery in Insurance Fundamentals",
    icon: <GraduationCap className="h-6 w-6" />,
    earned: false,
    rarity: "epic",
  },
  {
    id: "sales-champion",
    name: "Sales Champion",
    description: "Complete all Sales & Service modules",
    icon: <Trophy className="h-6 w-6" />,
    earned: false,
    rarity: "epic",
  },
  {
    id: "compliance-hero",
    name: "Compliance Hero",
    description: "Achieve 100% on Annual Compliance Review",
    icon: <Shield className="h-6 w-6" />,
    earned: true,
    earnedDate: "2024-02-01",
    rarity: "rare",
  },
  {
    id: "streak-7",
    name: "Week Warrior",
    description: "Complete training 7 days in a row",
    icon: <Flame className="h-6 w-6" />,
    earned: true,
    earnedDate: "2024-01-28",
    rarity: "rare",
  },
  {
    id: "all-rounder",
    name: "All-Rounder",
    description: "Achieve 50%+ mastery in all categories",
    icon: <Target className="h-6 w-6" />,
    earned: false,
    rarity: "epic",
  },
  {
    id: "legend",
    name: "Insurance Legend",
    description: "Achieve 100% mastery in all categories",
    icon: <Medal className="h-6 w-6" />,
    earned: false,
    rarity: "legendary",
  },
];

// =============================================================================
// COMPONENTS
// =============================================================================

function StatsBar() {
  const totalXP = 4250;
  const level = Math.floor(totalXP / 1000) + 1;
  const xpToNext = 1000 - (totalXP % 1000);
  const streak = 5;
  const completedModules = 14;
  const totalModules = 28;

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {/* Level & XP */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-white/20 rounded-full p-2">
              <Star className="h-5 w-5" />
            </div>
            <span className="text-white/80 text-sm">Level {level}</span>
          </div>
          <div className="text-2xl font-bold">{totalXP.toLocaleString()} XP</div>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>Next level</span>
              <span>{xpToNext} XP</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400 rounded-full"
                style={{ width: `${((1000 - xpToNext) / 1000) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Streak */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-white/20 rounded-full p-2">
              <Flame className="h-5 w-5 text-orange-300" />
            </div>
            <span className="text-white/80 text-sm">Streak</span>
          </div>
          <div className="text-2xl font-bold">{streak} Days</div>
          <p className="text-sm text-white/70 mt-2">Keep it going!</p>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-white/20 rounded-full p-2">
              <CheckCircle2 className="h-5 w-5 text-green-300" />
            </div>
            <span className="text-white/80 text-sm">Completed</span>
          </div>
          <div className="text-2xl font-bold">
            {completedModules}/{totalModules}
          </div>
          <p className="text-sm text-white/70 mt-2">
            {Math.round((completedModules / totalModules) * 100)}% complete
          </p>
        </div>

        {/* Badges */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-white/20 rounded-full p-2">
              <Award className="h-5 w-5 text-yellow-300" />
            </div>
            <span className="text-white/80 text-sm">Badges</span>
          </div>
          <div className="text-2xl font-bold">
            {BADGES.filter((b) => b.earned).length}/{BADGES.length}
          </div>
          <p className="text-sm text-white/70 mt-2">
            {BADGES.filter((b) => !b.earned).length} to unlock
          </p>
        </div>
      </div>
    </div>
  );
}

function ModuleCard({ module }: { module: TrainingModule }) {
  const typeIcons = {
    video: <Play className="h-4 w-4" />,
    interactive: <Target className="h-4 w-4" />,
    quiz: <FileText className="h-4 w-4" />,
    simulation: <Users className="h-4 w-4" />,
  };

  const typeLabels = {
    video: "Video",
    interactive: "Interactive",
    quiz: "Quiz",
    simulation: "Simulation",
  };

  return (
    <div
      className={`
        bg-white border rounded-lg p-4 transition-all
        ${module.locked ? "opacity-60" : "hover:shadow-md cursor-pointer"}
        ${module.completed ? "border-green-200 bg-green-50/50" : "border-gray-200"}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`
                inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
                ${
                  module.type === "video"
                    ? "bg-blue-100 text-blue-700"
                    : module.type === "interactive"
                    ? "bg-purple-100 text-purple-700"
                    : module.type === "quiz"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-cyan-100 text-cyan-700"
                }
              `}
            >
              {typeIcons[module.type]}
              {typeLabels[module.type]}
            </span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {module.duration}m
            </span>
          </div>
          <h4 className="font-medium text-gray-900">{module.title}</h4>
          <p className="text-sm text-gray-600 mt-1">{module.description}</p>

          {/* Progress bar for in-progress modules */}
          {module.progress !== undefined && !module.completed && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{module.progress}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${module.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 ml-4">
          {module.locked ? (
            <Lock className="h-5 w-5 text-gray-400" />
          ) : module.completed ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          )}
          <div className="flex items-center gap-1 text-xs font-medium text-amber-600">
            <Star className="h-3 w-3" />
            {module.xpReward} XP
          </div>
        </div>
      </div>
    </div>
  );
}

function SkillCategoryCard({
  category,
  expanded,
  onToggle,
}: {
  category: SkillCategory;
  expanded: boolean;
  onToggle: () => void;
}) {
  const completedCount = category.modules.filter((m) => m.completed).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full p-5 flex items-center gap-4 hover:bg-gray-50 transition-colors"
      >
        <div className={`${category.color} p-3 rounded-xl text-white`}>
          {category.icon}
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-gray-900">{category.name}</h3>
          <p className="text-sm text-gray-500">
            {completedCount} of {category.modules.length} modules completed
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Mastery indicator */}
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">
              {category.mastery}% Mastery
            </div>
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full rounded-full ${category.color}`}
                style={{ width: `${category.mastery}%` }}
              />
            </div>
          </div>
          <ChevronRight
            className={`h-5 w-5 text-gray-400 transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
          />
        </div>
      </button>

      {/* Expanded modules */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50">
          {category.modules.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </div>
      )}
    </div>
  );
}

function BadgeCard({ badge }: { badge: Badge }) {
  const rarityColors = {
    common: "from-gray-400 to-gray-500",
    rare: "from-blue-400 to-blue-600",
    epic: "from-purple-400 to-purple-600",
    legendary: "from-yellow-400 to-orange-500",
  };

  const rarityBg = {
    common: "bg-gray-100",
    rare: "bg-blue-50",
    epic: "bg-purple-50",
    legendary: "bg-gradient-to-br from-yellow-50 to-orange-50",
  };

  return (
    <div
      className={`
        relative rounded-xl p-4 border transition-all
        ${badge.earned ? rarityBg[badge.rarity] : "bg-gray-50 opacity-60"}
        ${badge.earned ? "border-transparent" : "border-gray-200"}
      `}
    >
      {/* Rarity indicator for legendary */}
      {badge.rarity === "legendary" && badge.earned && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-yellow-200/20 to-orange-200/20 pointer-events-none" />
      )}

      <div className="flex flex-col items-center text-center">
        <div
          className={`
            w-14 h-14 rounded-full flex items-center justify-center mb-3
            ${
              badge.earned
                ? `bg-gradient-to-br ${rarityColors[badge.rarity]} text-white`
                : "bg-gray-200 text-gray-400"
            }
          `}
        >
          {badge.icon}
        </div>
        <h4 className="font-medium text-gray-900 text-sm">{badge.name}</h4>
        <p className="text-xs text-gray-500 mt-1">{badge.description}</p>
        {badge.earned && badge.earnedDate && (
          <p className="text-xs text-gray-400 mt-2">
            Earned {new Date(badge.earnedDate).toLocaleDateString()}
          </p>
        )}
        {!badge.earned && (
          <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
            <Lock className="h-3 w-3" />
            Locked
          </div>
        )}
      </div>
    </div>
  );
}

function RecommendedSection() {
  const recommended = [
    {
      category: "Insurance Fundamentals",
      module: "Underwriting Fundamentals",
      reason: "Continue where you left off",
      progress: 45,
    },
    {
      category: "Sales & Service",
      module: "Retention Strategies",
      reason: "60% complete - almost there!",
      progress: 60,
    },
    {
      category: "Auto Insurance",
      module: "SR-22 & High Risk",
      reason: "Unlock Auto Expert certification",
      progress: 0,
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-indigo-600" />
        <h3 className="font-semibold text-gray-900">Recommended For You</h3>
      </div>

      <div className="space-y-3">
        {recommended.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
          >
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
              <Play className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {item.module}
              </p>
              <p className="text-xs text-gray-500">{item.category}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-indigo-600 font-medium">{item.reason}</p>
              {item.progress > 0 && (
                <div className="w-16 h-1 bg-gray-200 rounded-full mt-1">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function TrainingPage() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(
    "fundamentals"
  );
  const [activeTab, setActiveTab] = useState<"skills" | "badges">("skills");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Center</h1>
          <p className="text-gray-600 mt-1">
            Level up your insurance knowledge and skills
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Play className="h-4 w-4" />
          Continue Learning
        </button>
      </div>

      {/* Stats Bar */}
      <StatsBar />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Skills/Badges */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("skills")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "skills"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Skill Tree
              </span>
            </button>
            <button
              onClick={() => setActiveTab("badges")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "badges"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span className="flex items-center gap-2">
                <Award className="h-4 w-4" />
                Badges
              </span>
            </button>
          </div>

          {/* Skills Tab */}
          {activeTab === "skills" && (
            <div className="space-y-4">
              {SKILL_CATEGORIES.map((category) => (
                <SkillCategoryCard
                  key={category.id}
                  category={category}
                  expanded={expandedCategory === category.id}
                  onToggle={() =>
                    setExpandedCategory(
                      expandedCategory === category.id ? null : category.id
                    )
                  }
                />
              ))}
            </div>
          )}

          {/* Badges Tab */}
          {activeTab === "badges" && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {BADGES.map((badge) => (
                  <BadgeCard key={badge.id} badge={badge} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Recommendations & Leaderboard */}
        <div className="space-y-6">
          <RecommendedSection />

          {/* Daily Challenge */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-amber-100 p-2 rounded-lg">
                <Target className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Daily Challenge</h3>
            </div>
            <p className="text-sm text-gray-700 mb-3">
              Complete any quiz with 90%+ score
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-700 font-medium">
                Reward: 200 Bonus XP
              </span>
              <span className="text-xs text-gray-500">Resets in 8h 23m</span>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Leaderboard</h3>
              <span className="text-xs text-gray-500">This Month</span>
            </div>
            <div className="space-y-3">
              {[
                { rank: 1, name: "Sarah M.", xp: 12450, you: false },
                { rank: 2, name: "Mike R.", xp: 11200, you: false },
                { rank: 3, name: "You", xp: 4250, you: true },
                { rank: 4, name: "Lisa K.", xp: 3800, you: false },
                { rank: 5, name: "John D.", xp: 3200, you: false },
              ].map((user) => (
                <div
                  key={user.rank}
                  className={`flex items-center gap-3 p-2 rounded-lg ${
                    user.you ? "bg-indigo-50" : ""
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      user.rank === 1
                        ? "bg-yellow-100 text-yellow-700"
                        : user.rank === 2
                        ? "bg-gray-200 text-gray-700"
                        : user.rank === 3
                        ? "bg-orange-100 text-orange-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {user.rank}
                  </span>
                  <span
                    className={`flex-1 text-sm ${
                      user.you ? "font-medium text-indigo-700" : "text-gray-700"
                    }`}
                  >
                    {user.name}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {user.xp.toLocaleString()} XP
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
