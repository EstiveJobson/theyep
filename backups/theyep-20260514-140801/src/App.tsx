import {
  type CSSProperties,
  type ChangeEvent,
  FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AtSign,
  BadgeCheck,
  Bell,
  BookOpen,
  Camera,
  CalendarDays,
  Check,
  CircleAlert,
  GraduationCap,
  Flame,
  Hash,
  Home,
  Inbox,
  Landmark,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Radio,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  ThumbsDown,
  ThumbsUp,
  TimerReset,
  Trash2,
  TrendingUp,
  UserRound,
  UserCheck,
  UserPlus,
  UsersRound,
  Video,
  Volume2,
  X,
} from "lucide-react";
import {
  communities,
  events,
  initialComments,
  initialDrops,
  initialPosts,
  initialReports,
  lostFound,
  trends,
} from "./data";
import type {
  CampusEvent,
  Community,
  DirectConversation,
  Drop,
  LostFound,
  Notification,
  Post,
  PostComment,
  ReactionKey,
  Report,
  StudyGroup,
  Student,
  Trend,
  View,
} from "./types";
import {
  createCampusEvent,
  createCommunity as createCommunityRequest,
  createCommunityFeedPost,
  createDropPost,
  createFeedPost,
  createLostFoundItem,
  createPostComment,
  createPostReply,
  createReport,
  contactLostFoundItem,
  deleteCampusEvent,
  deleteCommunityRequest,
  deleteFeedPost,
  deleteLostFoundItem,
  deletePostComment,
  deleteProfileRequest,
  fetchDirectMessages,
  fetchBootstrap,
  fetchCampusEvents,
  markNotificationsRead,
  reactToFeedPost,
  resolveReportRequest,
  saveProfileToBackend,
  sendDirectMessage,
  startDirectConversation,
  toggleCommunityJoin,
  toggleEventRsvp,
  toggleFollowUser,
  updateCampusEvent,
  uploadMediaFile,
  voteCampusEvent,
} from "./api";

type Session = {
  email: string;
  name: string;
  campus: string;
};

type Theme = "light" | "dark";

type ProfileData = {
  name: string;
  handle: string;
  avatar: string;
  course: string;
  semester: string;
  campus: string;
  bio: string;
  vibe: string;
  favoriteSpot: string;
  interests: string[];
  photo?: string;
  theme: "pink" | "cyan" | "yellow" | "lime";
};

const defaultProfile: ProfileData = {
  name: "Sergio Matos",
  handle: "serginho",
  avatar: "SM",
  course: "Sistemas de Informacao",
  semester: "5th semester",
  campus: "Unifacs Salvador",
  bio: "Building TheYep between classes, caffeine, and campus chaos.",
  vibe: "curious ✨",
  favoriteSpot: "Patio central",
  interests: ["IHC", "AI", "CampusBeat", "Design"],
  theme: "pink",
};

const founderProfile: ProfileData = {
  name: "TheYep Founder",
  handle: "theyep.owner",
  avatar: "TY",
  course: "Founder Console",
  semester: "Owner",
  campus: "TheYep HQ",
  bio: "Conta maxima para moderar o TheYep sem invadir directs privados.",
  vibe: "founder ⚡",
  favoriteSpot: "Painel de moderacao",
  interests: ["Safety", "Campus", "Product"],
  theme: "cyan",
};

const profileThemes: Record<ProfileData["theme"], { label: string; color: string; soft: string }> = {
  pink: { label: "Pop pink", color: "#ff2d75", soft: "#fff4f8" },
  cyan: { label: "Electric cyan", color: "#00b8d9", soft: "#e9fbff" },
  yellow: { label: "Yep yellow", color: "#ffe94d", soft: "#fffbe0" },
  lime: { label: "Campus lime", color: "#8bd346", soft: "#f1ffe8" },
};

type EventVoteChoice = "true" | "false";

type EventFormState = {
  title: string;
  category: string;
  location: string;
  date: string;
  time: string;
};

type EventAuthorStats = {
  posted: number;
  real: number;
  fake: number;
  blockedUntil?: string;
};

type EventPostingStatus = {
  postedThisWeek: number;
  remainingThisWeek: number;
  blockedUntil?: string;
  isBlocked: boolean;
};

type DirectMessageDirection = "before" | "after";

const EVENT_WEEKLY_LIMIT = 2;
const EVENT_EDIT_LIMIT = 2;
const EVENT_FALSE_BLOCK_THRESHOLD = 3;
const EVENT_BLOCK_MONTHS = 1;

const navItems: Array<{
  id: View;
  label: string;
  icon: typeof Home;
}> = [
  { id: "home", label: "Feed", icon: Home },
  { id: "drops", label: "Drops", icon: TimerReset },
  { id: "trends", label: "Trends", icon: TrendingUp },
  { id: "direct", label: "Direct", icon: MessageCircle },
  { id: "videos", label: "Videos", icon: Video },
  { id: "communities", label: "Communities", icon: UsersRound },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "lost", label: "Lost + Found", icon: Inbox },
  { id: "moderation", label: "Safety", icon: ShieldCheck },
  { id: "profile", label: "Profile", icon: UserRound },
];

const reactionMeta: Array<{
  key: ReactionKey;
  label: string;
  icon: typeof ThumbsUp;
}> = [
  { key: "yep", label: "Yep", icon: ThumbsUp },
  { key: "nope", label: "Nope", icon: ThumbsDown },
  { key: "loud", label: "Loud", icon: Volume2 },
  { key: "mood", label: "Mood", icon: Sparkles },
  { key: "iconic", label: "Iconic", icon: Star },
  { key: "in", label: "I'm in", icon: Check },
];

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem("theyep-session");
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function loadTheme(): Theme {
  try {
    return localStorage.getItem("theyep-theme") === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function loadProfile(): ProfileData {
  try {
    const raw = localStorage.getItem("theyep-profile");
    if (!raw) return defaultProfile;
    const parsed = JSON.parse(raw) as Partial<ProfileData>;

    return {
      ...defaultProfile,
      ...parsed,
      interests: Array.isArray(parsed.interests) ? parsed.interests : defaultProfile.interests,
      theme: parsed.theme && parsed.theme in profileThemes ? parsed.theme : defaultProfile.theme,
    };
  } catch {
    return defaultProfile;
  }
}

function profileToStudent(profile: ProfileData): Student {
  return {
    name: profile.name,
    handle: profile.handle.replace(/^@/, ""),
    course: profile.course,
    semester: profile.semester,
    campus: profile.campus,
    avatar: profile.avatar,
    photo: profile.photo,
  };
}

function normalizeProfile(profile: ProfileData): ProfileData {
  const handle = profile.handle
    .trim()
    .replace(/^@/, "")
    .replace(/[^\w.]/g, "")
    .slice(0, 24);
  const avatar = profile.avatar
    .trim()
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 3)
    .toUpperCase();
  const interests = profile.interests
    .map((interest) => interest.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 8);

  return {
    ...profile,
    name: profile.name.trim() || defaultProfile.name,
    handle: handle || defaultProfile.handle,
    avatar: avatar || defaultProfile.avatar,
    course: profile.course.trim() || defaultProfile.course,
    semester: profile.semester.trim() || defaultProfile.semester,
    campus: profile.campus.trim() || defaultProfile.campus,
    bio: profile.bio.trim().slice(0, 160),
    vibe: profile.vibe.trim().slice(0, 32) || defaultProfile.vibe,
    favoriteSpot: profile.favoriteSpot.trim().slice(0, 60) || defaultProfile.favoriteSpot,
    interests,
    photo: profile.photo?.trim() || undefined,
  };
}

function Avatar({ initials, color, image }: { initials: string; color?: string; image?: string }) {
  return (
    <div className="avatar" style={color ? { background: color } : undefined}>
      {image ? <img src={image} alt="" /> : initials}
    </div>
  );
}

function MediaFilePicker({
  id,
  label,
  accept,
  fileName,
  icon,
  onChange,
  onClear,
}: {
  id: string;
  label: string;
  accept: string;
  fileName: string;
  icon: "image" | "video";
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  const Icon = icon === "video" ? Video : Camera;

  return (
    <div className={fileName ? "mediaFilePicker hasFile" : "mediaFilePicker"}>
      <label htmlFor={id}>
        <Icon size={18} />
        <span>{fileName || label}</span>
      </label>
      <input id={id} type="file" accept={accept} onChange={onChange} />
      {fileName ? (
        <button type="button" onClick={onClear} title="Remove selected file">
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
}

function initialsFromText(value: string) {
  const letters = value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase();

  return letters || "YP";
}

function hashText(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function getAccentWordCount(totalWords: number, candidateWords: number) {
  if (candidateWords === 0) return 0;
  if (totalWords < 5) return Math.min(1, candidateWords);
  if (totalWords < 10) return Math.min(2, candidateWords);
  return Math.min(candidateWords, Math.max(3, Math.ceil(totalWords / 4)));
}

function formatFileLimit(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

async function compressProfilePhoto(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read this photo."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Could not prepare this photo."));
    element.src = dataUrl;
  });
  const maxSize = 640;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not compress this photo.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Could not compress this photo."));
      },
      "image/jpeg",
      0.82,
    );
  });

  return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "profile"}-profile.jpg`, {
    type: "image/jpeg",
  });
}

function colorizePostText(text: string): ReactNode[] {
  const tokens = text.split(/(\s+)/);
  const wordEntries = tokens
    .map((token, index) => {
      const word = token.match(/[\p{L}\p{N}]+/gu)?.join("") ?? "";
      return { index, token, word };
    })
    .filter(({ word }) => word.length > 0);
  const hashtagIndexes = new Set(
    tokens
      .map((token, index) => (/^#[\p{L}\p{N}_]+$/u.test(token.trim()) ? index : -1))
      .filter((index) => index >= 0),
  );
  const candidates = wordEntries.filter(({ index, word }) => word.length >= 3 && !hashtagIndexes.has(index));
  const accentCount = getAccentWordCount(wordEntries.length, candidates.length);
  const accentedIndexes = new Map<number, "cyan" | "pink">();

  candidates
    .map((candidate) => ({
      ...candidate,
      score: hashText(`${text}|${candidate.token}|${candidate.index}`),
    }))
    .sort((left, right) => left.score - right.score)
    .slice(0, accentCount)
    .forEach((candidate) => {
      accentedIndexes.set(candidate.index, candidate.score % 2 === 0 ? "cyan" : "pink");
    });

  return tokens.map((token, index) => {
    if (hashtagIndexes.has(index)) {
      return (
        <span className="hashtagAccent" key={`${token}-${index}`}>
          {token}
        </span>
      );
    }

    const accent = accentedIndexes.get(index);
    if (!accent) return token;

    return (
      <span className={`wordAccent ${accent}`} key={`${token}-${index}`}>
        {token}
      </span>
    );
  });
}

function validateMood(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return { ok: false as const, error: "Add one mood word and one emoji." };
  }

  if (!/\p{Extended_Pictographic}/u.test(trimmed)) {
    return { ok: false as const, error: "Mood needs an emoji." };
  }

  const withoutEmoji = trimmed
    .replace(/\p{Extended_Pictographic}/gu, " ")
    .replace(/[\u200D\uFE0F]/g, " ")
    .trim();
  const words = withoutEmoji.match(/[\p{L}\p{N}]+/gu) ?? [];

  if (words.length !== 1) {
    return { ok: false as const, error: "Mood can only have one word plus emoji." };
  }

  return { ok: true as const, mood: trimmed };
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultEventForm(): EventFormState {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    title: "",
    category: "Campus",
    location: "",
    date: toDateInputValue(tomorrow),
    time: "18:00",
  };
}

function getEventFormFromEvent(event: CampusEvent): EventFormState {
  const startsAt = new Date(event.startsAt);

  return {
    title: event.title,
    category: event.category,
    location: event.location,
    date: toDateInputValue(startsAt),
    time: startsAt.toTimeString().slice(0, 5),
  };
}

function getEventStart(form: EventFormState) {
  return new Date(`${form.date}T${form.time || "00:00"}:00`);
}

function formatEventDate(startsAt: string) {
  const eventDate = new Date(startsAt);
  if (Number.isNaN(eventDate.getTime())) return "Date TBD";

  const day = eventDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const time = eventDate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${day}, ${time}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getStartOfWeek(date: Date) {
  const start = new Date(date);
  const dayOffset = (start.getDay() + 6) % 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - dayOffset);
  return start;
}

function isSamePostingWeek(value: string, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const weekStart = getStartOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  return date >= weekStart && date < weekEnd;
}

function isEventPast(event: CampusEvent, now = new Date()) {
  return new Date(event.startsAt).getTime() < now.getTime();
}

function getEventVerdict(event: CampusEvent, now = new Date()) {
  if (!isEventPast(event, now) || event.trueVotes === event.falseVotes) {
    return "pending" as const;
  }

  return event.trueVotes > event.falseVotes ? ("real" as const) : ("fake" as const);
}

function formatBlockDate(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function buildEventAuthorStats(campusEvents: CampusEvent[], now = new Date()) {
  const stats: Record<string, EventAuthorStats & { fakeDates: Date[] }> = {};

  campusEvents.forEach((event) => {
    const handle = event.author.handle;
    if (!stats[handle]) {
      stats[handle] = { posted: 0, real: 0, fake: 0, fakeDates: [] };
    }

    stats[handle].posted += 1;

    const verdict = getEventVerdict(event, now);
    if (verdict === "real") {
      stats[handle].real += 1;
    }
    if (verdict === "fake") {
      stats[handle].fake += 1;
      stats[handle].fakeDates.push(new Date(event.startsAt));
    }
  });

  return Object.fromEntries(
    Object.entries(stats).map(([handle, value]) => {
      const fakeDates = value.fakeDates
        .filter((date) => !Number.isNaN(date.getTime()))
        .sort((left, right) => left.getTime() - right.getTime());
      const latestFakeDate = fakeDates[fakeDates.length - 1];
      const blockedUntil =
        value.fake >= EVENT_FALSE_BLOCK_THRESHOLD && latestFakeDate
          ? addMonths(latestFakeDate, EVENT_BLOCK_MONTHS)
          : undefined;

      return [
        handle,
        {
          posted: value.posted,
          real: value.real,
          fake: value.fake,
          blockedUntil: blockedUntil && blockedUntil > now ? blockedUntil.toISOString() : undefined,
        },
      ];
    }),
  ) as Record<string, EventAuthorStats>;
}

function getEventPostingStatus(
  author: Student,
  campusEvents: CampusEvent[],
  authorStats: Record<string, EventAuthorStats>,
  now = new Date(),
): EventPostingStatus {
  const postedThisWeek = campusEvents.filter(
    (event) => event.author.handle === author.handle && isSamePostingWeek(event.createdAt, now),
  ).length;
  const blockedUntil = authorStats[author.handle]?.blockedUntil;

  return {
    postedThisWeek,
    remainingThisWeek: Math.max(0, EVENT_WEEKLY_LIMIT - postedThisWeek),
    blockedUntil,
    isBlocked: Boolean(blockedUntil && new Date(blockedUntil) > now),
  };
}

function countComments(comments: PostComment[]): number {
  return comments.reduce((total, comment) => total + 1 + countComments(comment.replies), 0);
}

function findCommentTarget(
  comments: PostComment[],
  commentId: string,
  rootId?: string,
  depth = 0,
): { comment: PostComment; rootId: string; depth: number } | null {
  for (const comment of comments) {
    const currentRootId = rootId ?? comment.id;
    if (comment.id === commentId) {
      return { comment, rootId: currentRootId, depth };
    }

    const nestedTarget = findCommentTarget(comment.replies, commentId, currentRootId, depth + 1);
    if (nestedTarget) {
      return nestedTarget;
    }
  }

  return null;
}

function addReplyToComment(
  comments: PostComment[],
  rootId: string,
  reply: PostComment,
): PostComment[] {
  return comments.map((comment) => {
    if (comment.id === rootId) {
      return {
        ...comment,
        replies: [...comment.replies, reply],
      };
    }

    return comment;
  });
}

function focusComment(commentId: string) {
  const element = document.getElementById(`comment-node-${commentId}`);
  if (!element) return;

  element.scrollIntoView({ behavior: "smooth", block: "center" });
  element.classList.add("commentFocused");
  window.setTimeout(() => {
    element.classList.remove("commentFocused");
  }, 1400);
}

function flattenCommentText(comments: PostComment[]): string {
  return comments
    .map((comment) => `${comment.body} ${comment.author.name} ${flattenCommentText(comment.replies)}`)
    .join(" ");
}

function collectCommentIdsWithReplies(comments: PostComment[]): string[] {
  return comments.flatMap((comment) => [
    ...(comment.replies.length > 0 ? [comment.id] : []),
    ...collectCommentIdsWithReplies(comment.replies),
  ]);
}

function Logo() {
  return (
    <div className="logoLockup" role="img" aria-label="TheYep">
      <div className="compactLogoMark">Y</div>
      <div className="logoFull" aria-hidden="true">
        <div className="logoSticker">
          <span className="logoWord logoThe">The</span>
          <span className="logoWord logoYep">Yep</span>
          <span className="logoBurst">
            <span />
            <span />
            <span />
          </span>
        </div>
        <p className="logoSlogan">
          Your campus. Your people. <span>Your feed.</span>
        </p>
      </div>
    </div>
  );
}

function ThemeToggle({
  theme,
  onToggle,
  compact = false,
}: {
  theme: Theme;
  onToggle: () => void;
  compact?: boolean;
}) {
  const isDark = theme === "dark";

  return (
    <button
      className={compact ? "themeToggle compact" : "themeToggle"}
      type="button"
      onClick={onToggle}
      aria-pressed={isDark}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="themeIcon">{isDark ? <Moon size={17} /> : <Sun size={17} />}</span>
      <span className="themeText">{isDark ? "Dark mode" : "Light mode"}</span>
      <span className="themeSwitch" aria-hidden="true">
        <span />
      </span>
    </button>
  );
}

function VerificationGate({
  onVerified,
  setProfilePreset,
}: {
  onVerified: (session: Session) => void;
  setProfilePreset: (profile: ProfileData) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("Sergio Matos");
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    const isUnifacs = normalized.endsWith("@unifacs.edu.br") || normalized.endsWith("@estudante.unifacs.br");

    if (!isUnifacs) {
      setError("Use um e-mail institucional da Unifacs para entrar neste beta.");
      return;
    }

    const session = {
      email: normalized,
      name: name.trim() || "Unifacs Student",
      campus: "Unifacs Salvador",
    };
    localStorage.setItem("theyep-session", JSON.stringify(session));
    onVerified(session);
  };

  const demo = () => {
    setProfilePreset(defaultProfile);
    localStorage.setItem("theyep-profile", JSON.stringify(defaultProfile));
    const session = {
      email: "sergio@estudante.unifacs.br",
      name: "Sergio Matos",
      campus: "Unifacs Salvador",
    };
    localStorage.setItem("theyep-session", JSON.stringify(session));
    onVerified(session);
  };

  const founderDemo = () => {
    setProfilePreset(founderProfile);
    localStorage.setItem("theyep-profile", JSON.stringify(founderProfile));
    const session = {
      email: "founder@theyep.app",
      name: founderProfile.name,
      campus: founderProfile.campus,
    };
    localStorage.setItem("theyep-session", JSON.stringify(session));
    onVerified(session);
  };

  return (
    <main className="gate">
      <section className="gatePanel">
        <Logo />
        <div className="gateCopy">
          <p className="eyebrow">Private campus beta</p>
          <h1>What is happening at Unifacs, right now.</h1>
          <p>
            Student-only feed, 24h drops, campus trends, communities, events,
            lost items, and safety tools in one loud little place.
          </p>
        </div>

        <form className="verifyForm" onSubmit={submit}>
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Institutional email
            <input
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
              placeholder="you@estudante.unifacs.br"
            />
          </label>
          {error ? <p className="formError">{error}</p> : null}
          <div className="buttonRow">
            <button className="primaryButton" type="submit">
              <LockKeyhole size={18} />
              Verify student
            </button>
            <button className="ghostButton" type="button" onClick={demo}>
              Use demo
            </button>
            <button className="ghostButton" type="button" onClick={founderDemo}>
              Founder mode
            </button>
          </div>
        </form>
      </section>

      <section className="gateImage" aria-label="Campus preview">
        <img
          src="https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1400&q=80"
          alt="Students walking on campus"
        />
        <div className="gateImageBadge">
          <Radio size={18} />
          3 trends live now
        </div>
      </section>
    </main>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [profile, setProfile] = useState<ProfileData>(() => loadProfile());
  const [activeView, setActiveView] = useState<View>("home");
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [userReactions, setUserReactions] = useState<Record<number, ReactionKey[]>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<number, PostComment[]>>(initialComments);
  const [openComments, setOpenComments] = useState<Set<number>>(() => new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [collapsedReplies, setCollapsedReplies] = useState<Set<string>>(() => new Set());
  const [drops, setDrops] = useState<Drop[]>(initialDrops);
  const [postBody, setPostBody] = useState("");
  const [postMood, setPostMood] = useState("");
  const [postImage, setPostImage] = useState("");
  const [postImageName, setPostImageName] = useState("");
  const [postMoodError, setPostMoodError] = useState("");
  const [videoBody, setVideoBody] = useState("");
  const [videoMood, setVideoMood] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFileName, setVideoFileName] = useState("");
  const [videoError, setVideoError] = useState("");
  const [dropBody, setDropBody] = useState("");
  const [dropImage, setDropImage] = useState("");
  const [dropImageName, setDropImageName] = useState("");
  const [dropError, setDropError] = useState("");
  const [focusedDropId, setFocusedDropId] = useState<number | null>(null);
  const [directConversations, setDirectConversations] = useState<DirectConversation[]>([]);
  const [activeDirectId, setActiveDirectId] = useState<string | null>(null);
  const [directDraft, setDirectDraft] = useState("");
  const [directPhoto, setDirectPhoto] = useState("");
  const [directPhotoName, setDirectPhotoName] = useState("");
  const [directRecipient, setDirectRecipient] = useState("");
  const [directStarterBody, setDirectStarterBody] = useState("");
  const [directStarterPhoto, setDirectStarterPhoto] = useState("");
  const [directStarterPhotoName, setDirectStarterPhotoName] = useState("");
  const [directGroupMode, setDirectGroupMode] = useState(false);
  const [directGroupName, setDirectGroupName] = useState("");
  const [directGroupAvatar, setDirectGroupAvatar] = useState("");
  const [directGroupAvatarName, setDirectGroupAvatarName] = useState("");
  const [directTab, setDirectTab] = useState<"social" | "lostfound">("social");
  const [directError, setDirectError] = useState("");
  const [directLoadingMessages, setDirectLoadingMessages] = useState<Set<string>>(() => new Set());
  const [selectedTrend, setSelectedTrend] = useState<string | null>(null);
  const [trendsData, setTrendsData] = useState<Trend[]>(trends);
  const [communitiesData, setCommunitiesData] = useState<Community[]>(communities);
  const [communityMembers, setCommunityMembers] = useState<Record<number, Student[]>>({});
  const [activeCommunityId, setActiveCommunityId] = useState<number | null>(null);
  const [communityDraft, setCommunityDraft] = useState({
    name: "",
    category: "",
    description: "",
    accent: "#00b8d9",
    avatar: "",
    avatarName: "",
  });
  const [communityCreateError, setCommunityCreateError] = useState("");
  const [communityPostBody, setCommunityPostBody] = useState("");
  const [communityPostMood, setCommunityPostMood] = useState("");
  const [communityPostError, setCommunityPostError] = useState("");
  const [communityPostEverywhere, setCommunityPostEverywhere] = useState(true);
  const [joinedCommunities, setJoinedCommunities] = useState<Set<number>>(() => new Set([1, 2]));
  const [campusEvents, setCampusEvents] = useState<CampusEvent[]>(events);
  const [rsvps, setRsvps] = useState<Set<number>>(() => new Set([2]));
  const [eventVotes, setEventVotes] = useState<Record<number, EventVoteChoice>>({});
  const [eventForm, setEventForm] = useState<EventFormState>(() => getDefaultEventForm());
  const [eventFormError, setEventFormError] = useState("");
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [lostFoundItems, setLostFoundItems] = useState<LostFound[]>(lostFound);
  const [lostFoundDraft, setLostFoundDraft] = useState({
    status: "Found" as "Lost" | "Found",
    item: "",
    location: "",
    image: "",
    imageName: "",
  });
  const [lostFoundError, setLostFoundError] = useState("");
  const [lostFoundContactDrafts, setLostFoundContactDrafts] = useState<Record<number, string>>({});
  const [activeLostFoundContactId, setActiveLostFoundContactId] = useState<number | null>(null);
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [following, setFollowing] = useState<Set<string>>(() => new Set());
  const [followers, setFollowers] = useState<Set<string>>(() => new Set());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [knownStudents, setKnownStudents] = useState<Student[]>([]);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("Harassment or bullying");
  const [search, setSearch] = useState("");
  const currentStudent = useMemo(() => profileToStudent(profile), [profile]);
  const eventAuthorStats = useMemo(() => buildEventAuthorStats(campusEvents), [campusEvents]);
  const eventPostingStatus = useMemo(
    () => getEventPostingStatus(currentStudent, campusEvents, eventAuthorStats),
    [campusEvents, currentStudent, eventAuthorStats],
  );
  const canModerate = currentStudent.handle === "theyep.owner" || currentStudent.handle === "theyep.admin";
  const unreadNotifications = notifications.filter((notification) => !notification.read).length;

  const applyBackendData = (data: {
    posts?: Post[];
    commentsByPost?: Record<number, PostComment[]>;
    userReactions?: Record<number, ReactionKey[]>;
    drops?: Drop[];
    directConversations?: DirectConversation[];
    communities?: Community[];
    communityMembers?: Record<number, Student[]>;
    joinedCommunities?: number[];
    events?: CampusEvent[];
    eventVotes?: Record<number, EventVoteChoice>;
    rsvps?: number[];
    lostFound?: LostFound[];
    reports?: Report[];
    trends?: Trend[];
    follows?: string[];
    followers?: string[];
    notifications?: Notification[];
    knownStudents?: Student[];
  }) => {
    if (data.posts) setPosts(data.posts);
    if (data.commentsByPost) setCommentsByPost(data.commentsByPost);
    if (data.userReactions) setUserReactions(data.userReactions);
    if (data.drops) setDrops(data.drops);
    if (data.directConversations) {
      setDirectConversations(data.directConversations);
      setActiveDirectId((current) => current ?? data.directConversations?.[0]?.id ?? null);
    }
    if (data.communities) setCommunitiesData(data.communities);
    if (data.communityMembers) setCommunityMembers(data.communityMembers);
    if (data.joinedCommunities) setJoinedCommunities(new Set(data.joinedCommunities));
    if (data.events) setCampusEvents(data.events);
    if (data.eventVotes) setEventVotes(data.eventVotes);
    if (data.rsvps) setRsvps(new Set(data.rsvps));
    if (data.lostFound) setLostFoundItems(data.lostFound);
    if (data.reports) setReports(data.reports);
    if (data.trends) setTrendsData(data.trends);
    if (data.follows) setFollowing(new Set(data.follows));
    if (data.followers) setFollowers(new Set(data.followers));
    if (data.notifications) setNotifications(data.notifications);
    if (data.knownStudents) setKnownStudents(data.knownStudents);
  };

  useEffect(() => {
    let isActive = true;

    fetchBootstrap<ProfileData>(currentStudent.handle)
      .then((data) => {
        if (!isActive) return;
        if (data.profile) {
          setProfile(normalizeProfile(data.profile));
        }
        setPosts(data.posts);
        setCommentsByPost(data.commentsByPost);
        setUserReactions(data.userReactions);
        setDrops(data.drops);
        setDirectConversations(data.directConversations);
        setActiveDirectId((current) => current ?? data.directConversations[0]?.id ?? null);
        setCommunitiesData(data.communities);
        setCommunityMembers(data.communityMembers);
        setJoinedCommunities(new Set(data.joinedCommunities));
        setCampusEvents(data.events);
        setEventVotes(data.eventVotes);
        setRsvps(new Set(data.rsvps));
        setLostFoundItems(data.lostFound);
        setReports(data.reports);
        setTrendsData(data.trends);
        setFollowing(new Set(data.follows));
        setFollowers(new Set(data.followers));
        setNotifications(data.notifications);
        setKnownStudents(data.knownStudents);
      })
      .catch(() => {
        // Keep seeded frontend data available if the local backend is not running yet.
      });

    return () => {
      isActive = false;
    };
  }, []);

  const visiblePosts = useMemo(() => {
    const mainFeedPosts = posts.filter((post) => !post.video && post.visibility !== "community");
    const trendFiltered = selectedTrend
      ? mainFeedPosts.filter((post) => post.tags.includes(selectedTrend))
      : mainFeedPosts;
    const query = search.trim().toLowerCase();
    if (!query) return trendFiltered;

    return trendFiltered.filter((post) => {
      const commentText = flattenCommentText(commentsByPost[post.id] ?? []);
      const haystack = `${post.body} ${post.mood} ${post.author.name} ${post.community} ${post.tags.join(" ")} ${commentText}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [commentsByPost, posts, search, selectedTrend]);
  const videoPosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const videos = posts.filter((post) => post.video);
    if (!query) return videos;

    return videos.filter((post) => {
      const commentText = flattenCommentText(commentsByPost[post.id] ?? []);
      const haystack = `${post.body} ${post.mood} ${post.author.name} ${post.community} ${post.tags.join(" ")} ${commentText}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [commentsByPost, posts, search]);
  const profileStats = useMemo(
    () => ({
      yeps: posts.filter((post) => post.author.handle === currentStudent.handle).length,
      drops: drops.filter((drop) => drop.author.handle === currentStudent.handle).length,
      communities: joinedCommunities.size,
    }),
    [currentStudent.handle, drops, joinedCommunities.size, posts],
  );

  if (!session) {
    return <VerificationGate onVerified={setSession} setProfilePreset={setProfile} />;
  }

  const activeAppTheme = profileThemes[profile.theme];
  const appAccentStyle = {
    "--app-accent": activeAppTheme.color,
    "--app-soft": activeAppTheme.soft,
  } as CSSProperties;
  const selectMediaFile = async (
    event: ChangeEvent<HTMLInputElement>,
    kind: "image" | "video",
    setMedia: (value: string) => void,
    setName: (value: string) => void,
    setError: (value: string) => void,
  ) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    const maxSize = kind === "image" ? 8 * 1024 * 1024 : 500 * 1024 * 1024;
    if (!file.type.startsWith(`${kind}/`)) {
      setError(kind === "image" ? "Choose an image file." : "Choose a video file.");
      return;
    }
    if (file.size > maxSize) {
      setError(`Choose a file up to ${formatFileLimit(maxSize)} for now.`);
      return;
    }

    try {
      setError("Uploading...");
      const upload = await uploadMediaFile(file);
      setMedia(upload.url);
      setName(file.name);
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not upload this file.");
    }
  };

  const uploadCompressedProfilePhoto = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      throw new Error("Choose an image file.");
    }

    const compressed = await compressProfilePhoto(file);
    const upload = await uploadMediaFile(compressed);
    return upload.url;
  };

  const createPost = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = postBody.trim();
    if (!trimmed) return;
    const moodValidation = validateMood(postMood);
    if (!moodValidation.ok) {
      setPostMoodError(moodValidation.error);
      return;
    }

    try {
      const data = await createFeedPost({
        author: currentStudent,
        body: trimmed,
        mood: moodValidation.mood,
        image: postImage || undefined,
      });
      applyBackendData(data);
      setPostBody("");
      setPostMood("");
      setPostImage("");
      setPostImageName("");
      setPostMoodError("");
      setActiveView("home");
    } catch (error) {
      setPostMoodError(error instanceof Error ? error.message : "Could not create this post.");
    }
  };

  const createVideo = async (event: FormEvent) => {
    event.preventDefault();
    const body = videoBody.trim();
    const video = videoUrl;
    const moodValidation = validateMood(videoMood);
    if (!body || !video) {
      setVideoError("Add a caption and choose a video.");
      return;
    }
    if (!moodValidation.ok) {
      setVideoError(moodValidation.error);
      return;
    }

    try {
      const data = await createFeedPost({
        author: currentStudent,
        body,
        mood: moodValidation.mood,
        video,
      });
      applyBackendData(data);
      setVideoBody("");
      setVideoMood("");
      setVideoUrl("");
      setVideoFileName("");
      setVideoError("");
      setActiveView("videos");
    } catch (error) {
      setVideoError(error instanceof Error ? error.message : "Could not post this video.");
    }
  };

  const createDrop = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = dropBody.trim();
    const image = dropImage;
    if (!trimmed) return;

    try {
      const data = await createDropPost({
        author: currentStudent,
        body: trimmed,
        image,
      });
      applyBackendData(data);
      setDropBody("");
      setDropImage("");
      setDropImageName("");
      setDropError("");
      setFocusedDropId(data.drops[0]?.id ?? null);
      setActiveView("drops");
    } catch (error) {
      setDropError(error instanceof Error ? error.message : "Could not create this drop.");
      // The backend owns drops now; keep the draft if the request fails.
    }
  };

  const submitDirectMessage = async (event: FormEvent, conversationId: string) => {
    event.preventDefault();
    const body = directDraft.trim();
    const image = directPhoto.trim();
    if (!body && !image) return;

    try {
      const data = await sendDirectMessage(conversationId, {
        author: currentStudent,
        body,
        image,
      });
      setDirectConversations(data.directConversations);
      setActiveDirectId(data.conversation.id);
      setDirectDraft("");
      setDirectPhoto("");
      setDirectPhotoName("");
      setDirectError("");
    } catch (error) {
      setDirectError(error instanceof Error ? error.message : "Could not send this direct.");
    }
  };

  const submitDirectStarter = async (event: FormEvent) => {
    event.preventDefault();
    const recipientHandles = [
      ...new Set(
        directRecipient
          .split(/[,\s]+/)
          .map((handle) => handle.trim().replace(/^@/, ""))
          .filter(Boolean),
      ),
    ];
    const body = directStarterBody.trim();
    const image = directStarterPhoto.trim();
    if (recipientHandles.length === 0 || (!body && !image)) {
      setDirectError("Add @handles and a message or photo to start the direct.");
      return;
    }

    try {
      const data = await startDirectConversation({
        author: currentStudent,
        recipientHandles,
        body,
        image,
        isGroup: directGroupMode || recipientHandles.length > 1,
        title: directGroupName.trim(),
        avatar: directGroupAvatar || undefined,
      });
      setDirectConversations(data.directConversations);
      setActiveDirectId(data.conversation.id);
      setDirectRecipient("");
      setDirectStarterBody("");
      setDirectStarterPhoto("");
      setDirectStarterPhotoName("");
      setDirectGroupName("");
      setDirectGroupAvatar("");
      setDirectGroupAvatarName("");
      setDirectGroupMode(false);
      setDirectTab("social");
      setDirectError("");
    } catch (error) {
      setDirectError(error instanceof Error ? error.message : "Could not start this direct.");
    }
  };

  const loadDirectMessages = async (conversationId: string, direction: DirectMessageDirection) => {
    const loadingKey = `${conversationId}:${direction}`;
    if (directLoadingMessages.has(loadingKey)) return;

    const conversation = directConversations.find((item) => item.id === conversationId);
    if (!conversation) return;

    const hasMore =
      direction === "before"
        ? conversation.messageWindow?.hasMoreBefore
        : conversation.messageWindow?.hasMoreAfter;
    if (!hasMore) return;

    const cursor =
      direction === "before"
        ? conversation.messages[0]?.id
        : conversation.messages[conversation.messages.length - 1]?.id;
    if (!cursor) return;

    setDirectLoadingMessages((current) => new Set(current).add(loadingKey));
    try {
      const data = await fetchDirectMessages(conversationId, {
        handle: currentStudent.handle,
        [direction]: cursor,
      });

      setDirectConversations((current) =>
        current.map((item) => {
          if (item.id !== conversationId) return item;

          const merged = direction === "before"
            ? [...data.messages, ...item.messages]
            : [...item.messages, ...data.messages];
          const uniqueMessages = Array.from(
            new Map(merged.map((message) => [message.id, message])).values(),
          ).sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());

          return {
            ...item,
            messages: uniqueMessages,
            messageWindow: {
              total: data.messageWindow.total,
              hasMoreBefore:
                direction === "before"
                  ? data.messageWindow.hasMoreBefore
                  : item.messageWindow?.hasMoreBefore ?? false,
              hasMoreAfter:
                direction === "after"
                  ? data.messageWindow.hasMoreAfter
                  : item.messageWindow?.hasMoreAfter ?? false,
              beforeCursor: uniqueMessages[0]?.id,
              afterCursor: uniqueMessages[uniqueMessages.length - 1]?.id,
            },
          };
        }),
      );
    } catch {
      // Keep the current message window if pagination fails.
    } finally {
      setDirectLoadingMessages((current) => {
        const next = new Set(current);
        next.delete(loadingKey);
        return next;
      });
    }
  };

  const trimDirectMessages = (conversationId: string, centerMessageId: string) => {
    setDirectConversations((current) =>
      current.map((conversation) => {
        if (conversation.id !== conversationId || conversation.messages.length <= 64) return conversation;

        const centerIndex = Math.max(
          0,
          conversation.messages.findIndex((message) => message.id === centerMessageId),
        );
        const start = Math.max(0, centerIndex - 28);
        const end = Math.min(conversation.messages.length, centerIndex + 29);
        const messages = conversation.messages.slice(start, end);

        return {
          ...conversation,
          messages,
          messageWindow: {
            total: conversation.messageWindow?.total ?? conversation.messages.length,
            hasMoreBefore: Boolean(conversation.messageWindow?.hasMoreBefore || start > 0),
            hasMoreAfter: Boolean(conversation.messageWindow?.hasMoreAfter || end < conversation.messages.length),
            beforeCursor: messages[0]?.id,
            afterCursor: messages[messages.length - 1]?.id,
          },
        };
      }),
    );
  };

  const updateEventForm = (updates: Partial<EventFormState>) => {
    setEventForm((current) => ({ ...current, ...updates }));
    setEventFormError("");
  };

  const resetEventComposer = () => {
    setEventForm(getDefaultEventForm());
    setEditingEventId(null);
    setEventFormError("");
  };

  const submitEvent = async (event: FormEvent) => {
    event.preventDefault();
    const title = eventForm.title.trim();
    const category = eventForm.category.trim();
    const location = eventForm.location.trim();
    const startsAt = getEventStart(eventForm);
    const now = new Date();

    if (!title || !category || !location || Number.isNaN(startsAt.getTime())) {
      setEventFormError("Fill the title, category, location, date, and time.");
      return;
    }

    if (startsAt <= now) {
      setEventFormError("Events can only be posted or edited while they are still upcoming.");
      return;
    }

    const eventPayload = {
      title,
      category,
      location,
      startsAt: startsAt.toISOString(),
    };

    if (editingEventId) {
      const existingEvent = campusEvents.find((campusEvent) => campusEvent.id === editingEventId);
      if (!existingEvent) return;
      if (existingEvent.author.handle !== currentStudent.handle) {
        setEventFormError("Only the original poster can edit this event.");
        return;
      }
      if (existingEvent.editCount >= EVENT_EDIT_LIMIT) {
        setEventFormError("This event has already used its 2 edits.");
        return;
      }
      if (isEventPast(existingEvent, now)) {
        setEventFormError("Past events cannot be edited.");
        return;
      }

      try {
        const result = await updateCampusEvent(editingEventId, {
          ...eventPayload,
          authorHandle: currentStudent.handle,
        });
        if (result.events) setCampusEvents(result.events);
        if (result.eventVotes) setEventVotes(result.eventVotes);
        if (result.rsvps) setRsvps(new Set(result.rsvps));
        resetEventComposer();
      } catch (error) {
        setEventFormError(error instanceof Error ? error.message : "Could not update this event.");
      }
      return;
    }

    if (eventPostingStatus.isBlocked) {
      setEventFormError(`Event posting is paused until ${formatBlockDate(eventPostingStatus.blockedUntil)}.`);
      return;
    }

    if (eventPostingStatus.postedThisWeek >= EVENT_WEEKLY_LIMIT) {
      setEventFormError("You already posted 2 events this week.");
      return;
    }

    try {
      const result = await createCampusEvent({
        ...eventPayload,
        author: currentStudent,
      });
      if (result.events) setCampusEvents(result.events);
      if (result.eventVotes) setEventVotes(result.eventVotes);
      if (result.rsvps) setRsvps(new Set(result.rsvps));
      resetEventComposer();
    } catch (error) {
      setEventFormError(error instanceof Error ? error.message : "Could not post this event.");
    }
  };

  const startEditingEvent = (event: CampusEvent) => {
    setEditingEventId(event.id);
    setEventForm(getEventFormFromEvent(event));
    setEventFormError("");
  };

  const voteOnEvent = async (eventId: number, choice: EventVoteChoice) => {
    const targetEvent = campusEvents.find((campusEvent) => campusEvent.id === eventId);
    if (!targetEvent || !isEventPast(targetEvent)) return;

    try {
      const result = await voteCampusEvent(eventId, {
        authorHandle: currentStudent.handle,
        choice,
      });
      if (result.events) setCampusEvents(result.events);
      setEventVotes((current) => {
        const next = { ...current };
        if (result.userVote) {
          next[eventId] = result.userVote;
        } else {
          delete next[eventId];
        }
        return next;
      });
    } catch {
      // The backend owns event votes; if it is offline, keep the UI unchanged.
    }
  };

  const reactToPost = async (postId: number, key: ReactionKey) => {
    try {
      const data = await reactToFeedPost(postId, key, currentStudent.handle);
      applyBackendData(data);
    } catch {
      // The backend enforces duplicate reactions and the 3-reaction limit.
    }
  };

  const toggleComments = (postId: number) => {
    setOpenComments((current) => {
      const next = new Set(current);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
        setCollapsedReplies((collapsed) => {
          const nextCollapsed = new Set(collapsed);
          collectCommentIdsWithReplies(commentsByPost[postId] ?? []).forEach((commentId) => {
            nextCollapsed.add(commentId);
          });
          return nextCollapsed;
        });
      }
      return next;
    });
  };

  const updateCommentDraft = (postId: number, value: string) => {
    setCommentDrafts((current) => ({
      ...current,
      [postId]: value,
    }));
  };

  const submitComment = async (event: FormEvent, postId: number) => {
    event.preventDefault();
    const body = (commentDrafts[postId] ?? "").trim();
    if (!body) return;

    try {
      const data = await createPostComment(postId, {
        author: currentStudent,
        body,
      });
      applyBackendData(data);
      updateCommentDraft(postId, "");
      setOpenComments((current) => new Set(current).add(postId));
    } catch {
      // Comments live in the backend now; keep the draft if the request fails.
    }
  };

  const updateReplyDraft = (commentId: string, value: string) => {
    setReplyDrafts((current) => ({
      ...current,
      [commentId]: value,
    }));
  };

  const submitReply = async (event: FormEvent, postId: number, parentId: string) => {
    event.preventDefault();
    const body = (replyDrafts[parentId] ?? "").trim();
    if (!body) return;
    const parentTarget = findCommentTarget(commentsByPost[postId] ?? [], parentId);
    if (!parentTarget) return;

    try {
      const data = await createPostReply(postId, parentId, {
        author: currentStudent,
        body,
      });
      applyBackendData(data);
      updateReplyDraft(parentId, "");
      setActiveReplyId(null);
      setCollapsedReplies((current) => {
        const next = new Set(current);
        next.delete(parentTarget.rootId);
        return next;
      });
    } catch {
      // Replies are persisted by the backend now; keep the draft if it fails.
    }
  };

  const deletePost = async (postId: number) => {
    try {
      const data = await deleteFeedPost(postId, currentStudent.handle);
      applyBackendData(data);
      setOpenComments((current) => {
        const next = new Set(current);
        next.delete(postId);
        return next;
      });
    } catch {
      // Deletion permissions are enforced by the backend.
    }
  };

  const deleteComment = async (postId: number, commentId: string) => {
    try {
      const data = await deletePostComment(postId, commentId, currentStudent.handle);
      applyBackendData(data);
    } catch {
      // The backend decides who can remove each comment.
    }
  };

  const toggleReplies = (commentId: string) => {
    setCollapsedReplies((current) => {
      const next = new Set(current);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  const toggleSet = (
    setter: React.Dispatch<React.SetStateAction<Set<number>>>,
    id: number,
  ) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleCommunity = async (id: number) => {
    try {
      const data = await toggleCommunityJoin(id, currentStudent.handle);
      setCommunitiesData(data.communities);
      setCommunityMembers(data.communityMembers);
      setJoinedCommunities(new Set(data.joinedCommunities));
    } catch {
      // Community joins are backend-owned.
    }
  };

  const toggleFollow = async (targetHandle: string) => {
    if (targetHandle === currentStudent.handle) return;
    try {
      const data = await toggleFollowUser(currentStudent.handle, targetHandle);
      setFollowing(new Set(data.follows));
      setFollowers(new Set(data.followers));
      if (data.notifications) setNotifications(data.notifications);
    } catch {
      // The backend owns the social graph.
    }
  };

  const updateCommunityDraft = (updates: Partial<typeof communityDraft>) => {
    setCommunityDraft((current) => ({ ...current, ...updates }));
    setCommunityCreateError("");
  };

  const submitCommunity = async (event: FormEvent) => {
    event.preventDefault();
    const name = communityDraft.name.trim();
    const category = communityDraft.category.trim();
    const description = communityDraft.description.trim();
    if (!name || !category || !description) {
      setCommunityCreateError("Add a name, category, and description.");
      return;
    }

    try {
      const data = await createCommunityRequest({
        author: currentStudent,
        name,
        category,
        description,
        accent: communityDraft.accent,
        avatar: communityDraft.avatar || undefined,
      });
      setCommunitiesData(data.communities);
      setCommunityMembers(data.communityMembers);
      setJoinedCommunities(new Set(data.joinedCommunities));
      setActiveCommunityId(data.communities[0]?.id ?? null);
      setCommunityDraft({ name: "", category: "", description: "", accent: "#00b8d9", avatar: "", avatarName: "" });
      setCommunityCreateError("");
    } catch (error) {
      setCommunityCreateError(error instanceof Error ? error.message : "Could not create this community.");
    }
  };

  const submitCommunityPost = async (event: FormEvent, communityId: number) => {
    event.preventDefault();
    const body = communityPostBody.trim();
    const moodValidation = validateMood(communityPostMood);
    if (!body) return;
    if (!moodValidation.ok) {
      setCommunityPostError(moodValidation.error);
      return;
    }

    try {
      const data = await createCommunityFeedPost(communityId, {
        author: currentStudent,
        body,
        mood: moodValidation.mood,
        visibility: communityPostEverywhere ? "both" : "community",
      });
      applyBackendData(data);
      setCommunityPostBody("");
      setCommunityPostMood("");
      setCommunityPostEverywhere(true);
      setCommunityPostError("");
    } catch (error) {
      setCommunityPostError(error instanceof Error ? error.message : "Could not post in this community.");
    }
  };

  const deleteCommunity = async (communityId: number) => {
    try {
      const data = await deleteCommunityRequest(communityId, currentStudent.handle);
      setCommunitiesData(data.communities);
      setCommunityMembers(data.communityMembers);
      setJoinedCommunities(new Set(data.joinedCommunities));
      setActiveCommunityId((current) => (current === communityId ? data.communities[0]?.id ?? null : current));
    } catch {
      // Community deletion permissions are backend-owned.
    }
  };

  const submitLostFound = async (event: FormEvent) => {
    event.preventDefault();
    const item = lostFoundDraft.item.trim();
    const location = lostFoundDraft.location.trim();
    if (!item || !location) {
      setLostFoundError("Add the item and where it was lost or found.");
      return;
    }

    try {
      const data = await createLostFoundItem({
        author: currentStudent,
        status: lostFoundDraft.status,
        item,
        location,
        image: lostFoundDraft.image || undefined,
      });
      setLostFoundItems(data.lostFound);
      setLostFoundDraft({ status: "Found", item: "", location: "", image: "", imageName: "" });
      setLostFoundError("");
    } catch (error) {
      setLostFoundError(error instanceof Error ? error.message : "Could not create this lost + found.");
    }
  };

  const contactLostFound = async (itemId: number) => {
    const body = (lostFoundContactDrafts[itemId] ?? "").trim();
    if (!body) return;

    try {
      const data = await contactLostFoundItem(itemId, { author: currentStudent, body });
      setLostFoundItems(data.lostFound);
      if (data.directConversations) setDirectConversations(data.directConversations);
      if (data.conversation) setActiveDirectId(data.conversation.id);
      setLostFoundContactDrafts((current) => ({ ...current, [itemId]: "" }));
      setActiveLostFoundContactId(null);
      setDirectTab("lostfound");
      setActiveView("direct");
    } catch (error) {
      setLostFoundError(error instanceof Error ? error.message : "Could not contact this person.");
    }
  };

  const deleteLostFound = async (itemId: number) => {
    try {
      const data = await deleteLostFoundItem(itemId, currentStudent.handle);
      setLostFoundItems(data.lostFound);
    } catch {
      // Lost + Found deletion permissions are backend-owned.
    }
  };

  const deleteEvent = async (eventId: number) => {
    try {
      const data = await deleteCampusEvent(eventId, currentStudent.handle);
      if (data.events) setCampusEvents(data.events);
      if (data.eventVotes) setEventVotes(data.eventVotes);
      if (data.rsvps) setRsvps(new Set(data.rsvps));
    } catch {
      // Event deletion permissions are backend-owned.
    }
  };

  const toggleRsvp = async (id: number) => {
    try {
      const data = await toggleEventRsvp(id, currentStudent.handle);
      if (data.events) setCampusEvents(data.events);
      if (data.rsvps) setRsvps(new Set(data.rsvps));
      if (data.eventVotes) setEventVotes(data.eventVotes);
    } catch {
      // RSVPs are backend-owned.
    }
  };

  const submitReport = async (event: FormEvent) => {
    event.preventDefault();
    if (!reportTarget) return;

    try {
      const data = await createReport({
        target: reportTarget,
        reason: reportReason,
      });
      setReports(data.reports);
      setReportTarget(null);
      setActiveView("moderation");
    } catch {
      // Reports are stored by the backend now; leave the modal open if it fails.
    }
  };

  const resolveReport = async (reportId: number) => {
    try {
      const data = await resolveReportRequest(reportId);
      setReports(data.reports);
    } catch {
      // Moderation state is backend-owned.
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      const data = await markNotificationsRead(currentStudent.handle);
      setNotifications(data.notifications);
    } catch {
      setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    }
  };

  const saveProfile = async (nextProfile: ProfileData) => {
    const normalized = normalizeProfile(nextProfile);
    try {
      const data = await saveProfileToBackend(currentStudent.handle, normalized);
      const savedProfile = normalizeProfile(data.profile);
      setProfile(savedProfile);
      localStorage.setItem("theyep-profile", JSON.stringify(savedProfile));
    } catch {
      setProfile(normalized);
      localStorage.setItem("theyep-profile", JSON.stringify(normalized));
    }
  };

  const deleteAccount = async (targetHandle = currentStudent.handle) => {
    try {
      const data = await deleteProfileRequest(targetHandle, currentStudent.handle);
      if (targetHandle === currentStudent.handle) {
        localStorage.removeItem("theyep-session");
        localStorage.removeItem("theyep-profile");
        setSession(null);
        setProfile(defaultProfile);
        return;
      }
      applyBackendData(data);
    } catch {
      // Account deletion permissions are backend-owned.
    }
  };

  const logout = () => {
    localStorage.removeItem("theyep-session");
    setSession(null);
  };

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem("theyep-theme", next);
      return next;
    });
  };

  const openDropFromStrip = (dropId: number) => {
    setFocusedDropId(dropId);
    setActiveView("drops");
  };

  return (
    <div className="appShell" data-theme={theme} style={appAccentStyle}>
      <aside className="sidebar">
        <Logo />
        <nav className="navList" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              className={activeView === item.id ? "navButton active" : "navButton"}
              key={item.id}
              onClick={() => setActiveView(item.id)}
              title={item.label}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />

        <div className="verifiedCard">
          <ShieldCheck size={19} />
          <div>
            <strong>Verified campus</strong>
            <span>{session.campus}</span>
          </div>
        </div>
      </aside>

      <header className="mobileHeader">
        <Logo />
        <div className="mobileHeaderActions">
          <ThemeToggle theme={theme} onToggle={toggleTheme} compact />
          <button className="iconButton" title="Notifications">
            <Bell size={19} />
            {unreadNotifications ? <span className="notificationDot">{unreadNotifications}</span> : null}
          </button>
        </div>
      </header>

      <main className="mainColumn">
        <div className="topBar">
          <div>
            <p className="eyebrow">{session.campus}</p>
            <h1>{viewTitle(activeView)}</h1>
          </div>
          <label className="searchBox">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search posts, tags, people"
            />
          </label>
        </div>

        <div className="mobileNav" aria-label="Mobile navigation">
          {navItems.map((item) => (
            <button
              className={activeView === item.id ? "mobileNavButton active" : "mobileNavButton"}
              key={item.id}
              onClick={() => setActiveView(item.id)}
              title={item.label}
            >
              <item.icon size={18} />
            </button>
          ))}
        </div>

        {activeView === "home" ? (
          <HomeView
            drops={drops}
            posts={visiblePosts}
            currentStudent={currentStudent}
            following={following}
            toggleFollow={toggleFollow}
            userReactions={userReactions}
            commentsByPost={commentsByPost}
            openComments={openComments}
            commentDrafts={commentDrafts}
            replyDrafts={replyDrafts}
            activeReplyId={activeReplyId}
            collapsedReplies={collapsedReplies}
            selectedTrend={selectedTrend}
            openDrop={openDropFromStrip}
            postBody={postBody}
            setPostBody={setPostBody}
            postMood={postMood}
            setPostMood={(value) => {
              setPostMood(value);
              setPostMoodError("");
            }}
            postImageName={postImageName}
            selectPostImage={(event) =>
              selectMediaFile(event, "image", setPostImage, setPostImageName, setPostMoodError)
            }
            clearPostImage={() => {
              setPostImage("");
              setPostImageName("");
              setPostMoodError("");
            }}
            postMoodError={postMoodError}
            createPost={createPost}
            reactToPost={reactToPost}
            toggleComments={toggleComments}
            updateCommentDraft={updateCommentDraft}
            submitComment={submitComment}
            updateReplyDraft={updateReplyDraft}
            submitReply={submitReply}
            deletePost={deletePost}
            deleteComment={deleteComment}
            setActiveReplyId={setActiveReplyId}
            toggleReplies={toggleReplies}
            canModerate={canModerate}
            openReport={setReportTarget}
            clearTrend={() => setSelectedTrend(null)}
          />
        ) : null}

        {activeView === "drops" ? (
          <DropsView
            drops={drops}
            dropBody={dropBody}
            setDropBody={setDropBody}
            dropImage={dropImage}
            dropImageName={dropImageName}
            dropError={dropError}
            selectDropImage={(event) =>
              selectMediaFile(event, "image", setDropImage, setDropImageName, setDropError)
            }
            clearDropImage={() => {
              setDropImage("");
              setDropImageName("");
              setDropError("");
            }}
            focusedDropId={focusedDropId}
            createDrop={createDrop}
            openReport={setReportTarget}
          />
        ) : null}

        {activeView === "trends" ? (
          <TrendsView trends={trendsData} setSelectedTrend={setSelectedTrend} setActiveView={setActiveView} />
        ) : null}

        {activeView === "direct" ? (
          <DirectView
            conversations={directConversations}
            currentStudent={currentStudent}
            activeConversationId={activeDirectId}
            setActiveConversationId={setActiveDirectId}
            draft={directDraft}
            setDraft={(value) => {
              setDirectDraft(value);
              setDirectError("");
            }}
            photo={directPhoto}
            photoName={directPhotoName}
            selectPhoto={(event) =>
              selectMediaFile(event, "image", setDirectPhoto, setDirectPhotoName, setDirectError)
            }
            clearPhoto={() => {
              setDirectPhoto("");
              setDirectPhotoName("");
              setDirectError("");
            }}
            recipient={directRecipient}
            setRecipient={(value) => {
              setDirectRecipient(value);
              setDirectError("");
            }}
            starterBody={directStarterBody}
            setStarterBody={(value) => {
              setDirectStarterBody(value);
              setDirectError("");
            }}
            starterPhoto={directStarterPhoto}
            starterPhotoName={directStarterPhotoName}
            selectStarterPhoto={(event) =>
              selectMediaFile(event, "image", setDirectStarterPhoto, setDirectStarterPhotoName, setDirectError)
            }
            clearStarterPhoto={() => {
              setDirectStarterPhoto("");
              setDirectStarterPhotoName("");
              setDirectError("");
            }}
            groupMode={directGroupMode}
            setGroupMode={(value) => {
              setDirectGroupMode(value);
              setDirectError("");
            }}
            groupName={directGroupName}
            setGroupName={(value) => {
              setDirectGroupName(value);
              setDirectError("");
            }}
            groupAvatar={directGroupAvatar}
            groupAvatarName={directGroupAvatarName}
            selectGroupAvatar={(event) =>
              selectMediaFile(event, "image", setDirectGroupAvatar, setDirectGroupAvatarName, setDirectError)
            }
            clearGroupAvatar={() => {
              setDirectGroupAvatar("");
              setDirectGroupAvatarName("");
              setDirectError("");
            }}
            directTab={directTab}
            setDirectTab={setDirectTab}
            directError={directError}
            loadMessages={loadDirectMessages}
            trimMessages={trimDirectMessages}
            submitMessage={submitDirectMessage}
            submitStarter={submitDirectStarter}
          />
        ) : null}

        {activeView === "videos" ? (
          <VideosView
            posts={videoPosts}
            currentStudent={currentStudent}
            following={following}
            toggleFollow={toggleFollow}
            userReactions={userReactions}
            commentsByPost={commentsByPost}
            openComments={openComments}
            commentDrafts={commentDrafts}
            replyDrafts={replyDrafts}
            activeReplyId={activeReplyId}
            collapsedReplies={collapsedReplies}
            videoBody={videoBody}
            setVideoBody={setVideoBody}
            videoMood={videoMood}
            setVideoMood={(value) => {
              setVideoMood(value);
              setVideoError("");
            }}
            videoUrl={videoUrl}
            videoFileName={videoFileName}
            selectVideo={(event) =>
              selectMediaFile(event, "video", setVideoUrl, setVideoFileName, setVideoError)
            }
            clearVideo={() => {
              setVideoUrl("");
              setVideoFileName("");
              setVideoError("");
            }}
            videoError={videoError}
            createVideo={createVideo}
            reactToPost={reactToPost}
            toggleComments={toggleComments}
            updateCommentDraft={updateCommentDraft}
            submitComment={submitComment}
            updateReplyDraft={updateReplyDraft}
            submitReply={submitReply}
            deletePost={deletePost}
            deleteComment={deleteComment}
            canModerate={canModerate}
            setActiveReplyId={setActiveReplyId}
            toggleReplies={toggleReplies}
            openReport={setReportTarget}
          />
        ) : null}

        {activeView === "communities" ? (
          <CommunitiesView
            communities={communitiesData}
            posts={posts}
            currentStudent={currentStudent}
            userReactions={userReactions}
            commentsByPost={commentsByPost}
            openComments={openComments}
            commentDrafts={commentDrafts}
            replyDrafts={replyDrafts}
            activeReplyId={activeReplyId}
            collapsedReplies={collapsedReplies}
            communityMembers={communityMembers}
            activeCommunityId={activeCommunityId}
            setActiveCommunityId={setActiveCommunityId}
            joinedCommunities={joinedCommunities}
            toggleCommunity={toggleCommunity}
            communityDraft={communityDraft}
            updateCommunityDraft={updateCommunityDraft}
            selectCommunityAvatar={(event) =>
              selectMediaFile(
                event,
                "image",
                (value) => updateCommunityDraft({ avatar: value }),
                (value) => updateCommunityDraft({ avatarName: value }),
                setCommunityCreateError,
              )
            }
            clearCommunityAvatar={() => updateCommunityDraft({ avatar: "", avatarName: "" })}
            submitCommunity={submitCommunity}
            communityCreateError={communityCreateError}
            communityPostBody={communityPostBody}
            setCommunityPostBody={setCommunityPostBody}
            communityPostMood={communityPostMood}
            setCommunityPostMood={(value) => {
              setCommunityPostMood(value);
              setCommunityPostError("");
            }}
            communityPostError={communityPostError}
            communityPostEverywhere={communityPostEverywhere}
            setCommunityPostEverywhere={setCommunityPostEverywhere}
            submitCommunityPost={submitCommunityPost}
            reactToPost={reactToPost}
            toggleComments={toggleComments}
            updateCommentDraft={updateCommentDraft}
            submitComment={submitComment}
            updateReplyDraft={updateReplyDraft}
            submitReply={submitReply}
            deletePost={deletePost}
            deleteComment={deleteComment}
            deleteCommunity={deleteCommunity}
            setActiveReplyId={setActiveReplyId}
            toggleReplies={toggleReplies}
            following={following}
            toggleFollow={toggleFollow}
            canModerate={canModerate}
            openReport={setReportTarget}
          />
        ) : null}

        {activeView === "events" ? (
          <EventsView
            events={campusEvents}
            currentStudent={currentStudent}
            rsvps={rsvps}
            eventVotes={eventVotes}
            authorStats={eventAuthorStats}
            postingStatus={eventPostingStatus}
            eventForm={eventForm}
            eventFormError={eventFormError}
            editingEventId={editingEventId}
            updateEventForm={updateEventForm}
            submitEvent={submitEvent}
            cancelEditing={resetEventComposer}
            startEditingEvent={startEditingEvent}
            voteOnEvent={voteOnEvent}
            toggleRsvp={toggleRsvp}
            deleteEvent={deleteEvent}
            canModerate={canModerate}
          />
        ) : null}

        {activeView === "lost" ? (
          <LostFoundView
            items={lostFoundItems}
            currentStudent={currentStudent}
            draft={lostFoundDraft}
            setDraft={(updates) => {
              setLostFoundDraft((current) => ({ ...current, ...updates }));
              setLostFoundError("");
            }}
            error={lostFoundError}
            selectImage={(event) =>
              selectMediaFile(
                event,
                "image",
                (value) => setLostFoundDraft((current) => ({ ...current, image: value })),
                (value) => setLostFoundDraft((current) => ({ ...current, imageName: value })),
                setLostFoundError,
              )
            }
            clearImage={() => setLostFoundDraft((current) => ({ ...current, image: "", imageName: "" }))}
            submitLostFound={submitLostFound}
            contactDrafts={lostFoundContactDrafts}
            updateContactDraft={(itemId, value) =>
              setLostFoundContactDrafts((current) => ({ ...current, [itemId]: value }))
            }
            activeContactId={activeLostFoundContactId}
            setActiveContactId={setActiveLostFoundContactId}
            contactLostFound={contactLostFound}
            deleteLostFound={deleteLostFound}
            canModerate={canModerate}
          />
        ) : null}

        {activeView === "moderation" ? (
          <ModerationView
            reports={reports}
            resolveReport={resolveReport}
            currentStudent={currentStudent}
            knownStudents={knownStudents}
            canModerate={canModerate}
            deleteAccount={deleteAccount}
          />
        ) : null}

        {activeView === "profile" ? (
          <ProfileView
            profile={profile}
            saveProfile={saveProfile}
            logout={logout}
            yepsCount={profileStats.yeps}
            joinedCommunities={profileStats.communities}
            dropsCount={profileStats.drops}
            eventStats={eventAuthorStats[currentStudent.handle] ?? { posted: 0, real: 0, fake: 0 }}
            eventPostingStatus={eventPostingStatus}
            uploadProfilePhoto={uploadCompressedProfilePhoto}
            followersCount={followers.size}
            followingCount={following.size}
            deleteAccount={() => deleteAccount()}
            canModerate={canModerate}
          />
        ) : null}
      </main>

      <aside className="rightRail">
        <CampusPulse />
        <NotificationsRail
          notifications={notifications}
          unreadCount={unreadNotifications}
          markAllRead={markAllNotificationsRead}
          openDirect={(conversationId, type) => {
            setActiveDirectId(conversationId);
            setDirectTab(type === "lostfound" ? "lostfound" : "social");
            setActiveView("direct");
          }}
        />
        <TrendingRail
          trends={trendsData}
          selectedTrend={selectedTrend}
          onPick={(tag) => {
            setSelectedTrend(tag);
            setActiveView("home");
          }}
        />
        <MiniEvents events={campusEvents} />
      </aside>

      {reportTarget ? (
        <div className="modalBackdrop" role="dialog" aria-modal="true">
          <form className="modal" onSubmit={submitReport}>
            <button className="modalClose" type="button" onClick={() => setReportTarget(null)} title="Close">
              <X size={18} />
            </button>
            <CircleAlert size={26} />
            <h2>Report content</h2>
            <p>{reportTarget}</p>
            <label>
              Reason
              <select value={reportReason} onChange={(event) => setReportReason(event.target.value)}>
                <option>Harassment or bullying</option>
                <option>Exposes someone without consent</option>
                <option>Threat or unsafe behavior</option>
                <option>Spam or impersonation</option>
              </select>
            </label>
            <button className="primaryButton" type="submit">
              Send report
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function viewTitle(view: View) {
  const titles: Record<View, string> = {
    home: "Campus Feed",
    drops: "24h Drops",
    trends: "Trending Topics",
    direct: "Direct",
    videos: "Videos",
    communities: "Communities",
    events: "Events",
    lost: "Lost + Found",
    moderation: "Safety Center",
    profile: "Profile",
  };
  return titles[view];
}

function HomeView({
  drops,
  posts,
  currentStudent,
  following,
  toggleFollow,
  userReactions,
  commentsByPost,
  openComments,
  commentDrafts,
  replyDrafts,
  activeReplyId,
  collapsedReplies,
  selectedTrend,
  openDrop,
  postBody,
  setPostBody,
  postMood,
  setPostMood,
  postImageName,
  selectPostImage,
  clearPostImage,
  postMoodError,
  createPost,
  reactToPost,
  toggleComments,
  updateCommentDraft,
  submitComment,
  updateReplyDraft,
  submitReply,
  deletePost,
  deleteComment,
  setActiveReplyId,
  toggleReplies,
  canModerate,
  openReport,
  clearTrend,
}: {
  drops: Drop[];
  posts: Post[];
  currentStudent: Student;
  following: Set<string>;
  toggleFollow: (targetHandle: string) => void;
  userReactions: Record<number, ReactionKey[]>;
  commentsByPost: Record<number, PostComment[]>;
  openComments: Set<number>;
  commentDrafts: Record<number, string>;
  replyDrafts: Record<string, string>;
  activeReplyId: string | null;
  collapsedReplies: Set<string>;
  selectedTrend: string | null;
  openDrop: (dropId: number) => void;
  postBody: string;
  setPostBody: (value: string) => void;
  postMood: string;
  setPostMood: (value: string) => void;
  postImageName: string;
  selectPostImage: (event: ChangeEvent<HTMLInputElement>) => void;
  clearPostImage: () => void;
  postMoodError: string;
  createPost: (event: FormEvent) => void;
  reactToPost: (postId: number, key: ReactionKey) => void;
  toggleComments: (postId: number) => void;
  updateCommentDraft: (postId: number, value: string) => void;
  submitComment: (event: FormEvent, postId: number) => void;
  updateReplyDraft: (commentId: string, value: string) => void;
  submitReply: (event: FormEvent, postId: number, parentId: string) => void;
  deletePost: (postId: number) => void;
  deleteComment: (postId: number, commentId: string) => void;
  setActiveReplyId: (commentId: string | null) => void;
  toggleReplies: (commentId: string) => void;
  canModerate: boolean;
  openReport: (target: string) => void;
  clearTrend: () => void;
}) {
  return (
    <div className="viewStack">
      <DropStrip drops={drops} openDrop={openDrop} />

      <form className="composer" onSubmit={createPost}>
        <Avatar initials={currentStudent.avatar} image={currentStudent.photo} />
        <div className="composerBody">
          <textarea
            value={postBody}
            onChange={(event) => setPostBody(event.target.value)}
            placeholder="What should campus know?"
            rows={3}
          />
          <div className={postMoodError ? "moodInput invalid" : "moodInput"}>
            <label htmlFor="postMood">Mood</label>
            <input
              id="postMood"
              value={postMood}
              onChange={(event) => setPostMood(event.target.value)}
              placeholder="hyped 🔥"
              aria-invalid={postMoodError ? "true" : "false"}
            />
          </div>
          <MediaFilePicker
            id="feed-post-photo-file"
            label="Add photo from device"
            accept="image/*"
            fileName={postImageName}
            icon="image"
            onChange={selectPostImage}
            onClear={clearPostImage}
          />
          {postMoodError ? <p className="composerError">{postMoodError}</p> : null}
          <div className="composerActions">
            <div className="chipRow">
              <span className="tinyChip">#Campus</span>
              <span className="tinyChip">Photo</span>
              <span className="tinyChip">Poll</span>
            </div>
            <button className="primaryButton" type="submit">
              <Send size={17} />
              Post
            </button>
          </div>
        </div>
      </form>

      {selectedTrend ? (
        <div className="filterNotice">
          <Hash size={17} />
          Showing posts for {selectedTrend}
          <button onClick={clearTrend}>Clear</button>
        </div>
      ) : null}

      <section className="feedList" aria-label="Campus feed">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            userReactions={userReactions[post.id] ?? []}
            comments={commentsByPost[post.id] ?? []}
            currentStudent={currentStudent}
            following={following}
            toggleFollow={toggleFollow}
            commentsOpen={openComments.has(post.id)}
            commentDraft={commentDrafts[post.id] ?? ""}
            replyDrafts={replyDrafts}
            activeReplyId={activeReplyId}
            collapsedReplies={collapsedReplies}
            reactToPost={reactToPost}
            toggleComments={toggleComments}
            updateCommentDraft={updateCommentDraft}
            submitComment={submitComment}
            updateReplyDraft={updateReplyDraft}
            submitReply={submitReply}
            deletePost={deletePost}
            deleteComment={deleteComment}
            setActiveReplyId={setActiveReplyId}
            toggleReplies={toggleReplies}
            canModerate={canModerate}
            openReport={openReport}
          />
        ))}
      </section>
    </div>
  );
}

function DropStrip({ drops, openDrop }: { drops: Drop[]; openDrop: (dropId: number) => void }) {
  return (
    <section className="dropStrip" aria-label="Live drops">
      {drops.slice(0, 6).map((drop) => (
        <button className="dropBubble" key={drop.id} onClick={() => openDrop(drop.id)} type="button">
          <div className="dropMedia">
            {drop.image ? <img src={drop.image} alt={drop.body} /> : <span>{drop.body.slice(0, 28)}</span>}
          </div>
          <strong>{drop.author.avatar}</strong>
          <span>{drop.expiresIn}</span>
        </button>
      ))}
    </section>
  );
}

function PostCard({
  post,
  currentStudent,
  following,
  toggleFollow,
  userReactions,
  comments,
  commentsOpen,
  commentDraft,
  replyDrafts,
  activeReplyId,
  collapsedReplies,
  reactToPost,
  toggleComments,
  updateCommentDraft,
  submitComment,
  updateReplyDraft,
  submitReply,
  deletePost,
  deleteComment,
  setActiveReplyId,
  toggleReplies,
  canModerate,
  openReport,
}: {
  post: Post;
  currentStudent: Student;
  following: Set<string>;
  toggleFollow: (targetHandle: string) => void;
  userReactions: ReactionKey[];
  comments: PostComment[];
  commentsOpen: boolean;
  commentDraft: string;
  replyDrafts: Record<string, string>;
  activeReplyId: string | null;
  collapsedReplies: Set<string>;
  reactToPost: (postId: number, key: ReactionKey) => void;
  toggleComments: (postId: number) => void;
  updateCommentDraft: (postId: number, value: string) => void;
  submitComment: (event: FormEvent, postId: number) => void;
  updateReplyDraft: (commentId: string, value: string) => void;
  submitReply: (event: FormEvent, postId: number, parentId: string) => void;
  deletePost: (postId: number) => void;
  deleteComment: (postId: number, commentId: string) => void;
  setActiveReplyId: (commentId: string | null) => void;
  toggleReplies: (commentId: string) => void;
  canModerate: boolean;
  openReport: (target: string) => void;
}) {
  const reactionLimit = 3;
  const reactedSet = new Set(userReactions);
  const hasReachedReactionLimit = userReactions.length >= reactionLimit;
  const commentCount = countComments(comments);
  const isPostAuthor = post.author.handle === currentStudent.handle;
  const isFollowingAuthor = following.has(post.author.handle);

  return (
    <article className="postCard">
      <header className="postHeader">
        <Avatar initials={post.author.avatar} image={post.author.photo} />
        <div>
          <strong>{post.author.name}</strong>
          <span>
            @{post.author.handle} · {post.author.course} · {post.time}
          </span>
        </div>
        <span className="postMood">{post.mood}</span>
        {!isPostAuthor ? (
          <button
            className={isFollowingAuthor ? "followButton following" : "followButton"}
            type="button"
            onClick={() => toggleFollow(post.author.handle)}
          >
            {isFollowingAuthor ? <UserCheck size={15} /> : <UserPlus size={15} />}
            {isFollowingAuthor ? "Following" : "Follow"}
          </button>
        ) : null}
        {isPostAuthor || canModerate ? (
          <button className="iconButton subtle dangerIcon" title="Delete post" onClick={() => deletePost(post.id)}>
            <Trash2 size={17} />
          </button>
        ) : null}
        <button className="iconButton subtle" title="More options" onClick={() => openReport(`Post by @${post.author.handle}`)}>
          <MoreHorizontal size={18} />
        </button>
      </header>
      {post.communityId ? (
        <div className="communityPostBanner">
          <UsersRound size={17} />
          <span>
            Posted in <strong>{post.community}</strong>
            {post.visibility === "community" ? " only for members" : " and shared on campus feed"}
          </span>
        </div>
      ) : null}
      <p className="postBody">{colorizePostText(post.body)}</p>
      {post.image ? <img className="postImage" src={post.image} alt="" /> : null}
      {post.video ? <video className="postVideo" src={post.video} controls playsInline /> : null}
      {post.tags.length ? (
        <div className="tagRow">
          {post.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      <footer className="postFooter">
        <div className="reactionBar">
          {reactionMeta.map((reaction) => {
            const hasReacted = reactedSet.has(reaction.key);
            const isLocked = !hasReacted && hasReachedReactionLimit;
            const reactionAccent = hasReacted
              ? userReactions.indexOf(reaction.key) % 2 === 0
                ? "cyan"
                : "pink"
              : "";
            const reactionClass = [
              hasReacted ? `reacted ${reactionAccent}` : "",
              isLocked ? "reactionLocked" : "",
            ]
              .filter(Boolean)
              .join(" ");
            const title = hasReacted
              ? `Remove ${reaction.label}`
              : hasReachedReactionLimit
                ? "Reaction limit reached"
                : reaction.label;

            return (
              <button
                className={reactionClass || undefined}
                data-locked={isLocked ? "true" : undefined}
                key={reaction.key}
                title={title}
                aria-label={`${reaction.label}: ${post.reactions[reaction.key]}${hasReacted ? ", used" : ""}`}
                onClick={() => reactToPost(post.id, reaction.key)}
              >
                <reaction.icon size={15} />
                <span>{post.reactions[reaction.key]}</span>
              </button>
            );
          })}
        </div>
        <div className="reactionLimit">{userReactions.length}/3 reactions used</div>
        <div className="postStats">
          <button
            className="commentsToggle"
            type="button"
            onClick={() => toggleComments(post.id)}
            aria-expanded={commentsOpen}
          >
            <MessageCircle size={15} />
            {commentCount} {commentCount === 1 ? "comment" : "comments"}
          </button>
          <span>{post.community}</span>
        </div>
        {commentsOpen ? (
          <CommentPanel
            postId={post.id}
            currentStudent={currentStudent}
            comments={comments}
            commentDraft={commentDraft}
            replyDrafts={replyDrafts}
            activeReplyId={activeReplyId}
            collapsedReplies={collapsedReplies}
            updateCommentDraft={updateCommentDraft}
            submitComment={submitComment}
            updateReplyDraft={updateReplyDraft}
            submitReply={submitReply}
            deleteComment={deleteComment}
            setActiveReplyId={setActiveReplyId}
            toggleReplies={toggleReplies}
            postAuthorHandle={post.author.handle}
          />
        ) : null}
      </footer>
    </article>
  );
}

function CommentPanel({
  postId,
  currentStudent,
  comments,
  commentDraft,
  replyDrafts,
  activeReplyId,
  collapsedReplies,
  updateCommentDraft,
  submitComment,
  updateReplyDraft,
  submitReply,
  deleteComment,
  setActiveReplyId,
  toggleReplies,
  postAuthorHandle,
}: {
  postId: number;
  currentStudent: Student;
  comments: PostComment[];
  commentDraft: string;
  replyDrafts: Record<string, string>;
  activeReplyId: string | null;
  collapsedReplies: Set<string>;
  updateCommentDraft: (postId: number, value: string) => void;
  submitComment: (event: FormEvent, postId: number) => void;
  updateReplyDraft: (commentId: string, value: string) => void;
  submitReply: (event: FormEvent, postId: number, parentId: string) => void;
  deleteComment: (postId: number, commentId: string) => void;
  setActiveReplyId: (commentId: string | null) => void;
  toggleReplies: (commentId: string) => void;
  postAuthorHandle: string;
}) {
  return (
    <section className="commentPanel" aria-label="Post comments">
      <div className="commentPanelHeader">
        <strong>Campus replies</strong>
        <span>Newest first</span>
      </div>

      <form className="commentComposer" onSubmit={(event) => submitComment(event, postId)}>
        <Avatar initials={currentStudent.avatar} image={currentStudent.photo} />
        <input
          value={commentDraft}
          onChange={(event) => updateCommentDraft(postId, event.target.value)}
          placeholder="Add a comment..."
        />
        <button className="primaryButton" type="submit">
          Reply
        </button>
      </form>

      <div className="commentList">
        {comments.length === 0 ? (
          <p className="emptyComments">No comments yet. Start the thread.</p>
        ) : (
          comments.map((comment) => (
            <CommentThread
              activeReplyId={activeReplyId}
              collapsedReplies={collapsedReplies}
              comment={comment}
              depth={0}
              key={comment.id}
              postId={postId}
              currentStudent={currentStudent}
              postAuthorHandle={postAuthorHandle}
              replyDrafts={replyDrafts}
              setActiveReplyId={setActiveReplyId}
              submitReply={submitReply}
              deleteComment={deleteComment}
              toggleReplies={toggleReplies}
              updateReplyDraft={updateReplyDraft}
            />
          ))
        )}
      </div>
    </section>
  );
}

function CommentThread({
  comment,
  postId,
  currentStudent,
  postAuthorHandle,
  depth,
  replyDrafts,
  activeReplyId,
  collapsedReplies,
  updateReplyDraft,
  submitReply,
  deleteComment,
  setActiveReplyId,
  toggleReplies,
}: {
  comment: PostComment;
  postId: number;
  currentStudent: Student;
  postAuthorHandle: string;
  depth: number;
  replyDrafts: Record<string, string>;
  activeReplyId: string | null;
  collapsedReplies: Set<string>;
  updateReplyDraft: (commentId: string, value: string) => void;
  submitReply: (event: FormEvent, postId: number, parentId: string) => void;
  deleteComment: (postId: number, commentId: string) => void;
  setActiveReplyId: (commentId: string | null) => void;
  toggleReplies: (commentId: string) => void;
}) {
  const replyOpen = activeReplyId === comment.id;
  const hasReplies = comment.replies.length > 0;
  const repliesHidden = collapsedReplies.has(comment.id);
  const canDeleteComment =
    comment.author.handle === currentStudent.handle || postAuthorHandle === currentStudent.handle;

  return (
    <article className={depth > 0 ? "commentItem nested" : "commentItem"} id={`comment-node-${comment.id}`}>
      <Avatar initials={comment.author.avatar} image={comment.author.photo} />
      <div className="commentContent">
        <div className="commentBubble">
          <div className="commentMeta">
            <strong>{comment.author.name}</strong>
            <span>@{comment.author.handle} · {comment.time}</span>
          </div>
          <p>
            {comment.replyTo ? (
              <button
                className="replyMention"
                type="button"
                title={`Jump to ${comment.replyTo.name}`}
                onClick={() => focusComment(comment.replyTo!.id)}
              >
                @{comment.replyTo.handle}
              </button>
            ) : null}
            {comment.body}
          </p>
        </div>

        <div className="commentActions">
          <button type="button" onClick={() => setActiveReplyId(replyOpen ? null : comment.id)}>
            {replyOpen ? "Cancel" : "Reply"}
          </button>
          {hasReplies && depth === 0 ? (
            <button type="button" onClick={() => toggleReplies(comment.id)}>
              {repliesHidden ? "Show" : "Hide"} {comment.replies.length} replies
            </button>
          ) : null}
          {canDeleteComment ? (
            <button type="button" className="dangerTextButton" onClick={() => deleteComment(postId, comment.id)}>
              Delete
            </button>
          ) : null}
        </div>

        {replyOpen ? (
          <form className="replyComposer" onSubmit={(event) => submitReply(event, postId, comment.id)}>
            <input
              value={replyDrafts[comment.id] ?? ""}
              onChange={(event) => updateReplyDraft(comment.id, event.target.value)}
              placeholder={`Reply to ${comment.author.name.split(" ")[0]}...`}
            />
            <button className="ghostButton" type="submit">
              Send
            </button>
          </form>
        ) : null}

        {hasReplies && !repliesHidden && depth === 0 ? (
          <div className="commentReplies">
            {comment.replies.map((reply) => (
              <CommentThread
                activeReplyId={activeReplyId}
                collapsedReplies={collapsedReplies}
                comment={reply}
                currentStudent={currentStudent}
                depth={1}
                key={reply.id}
                postAuthorHandle={postAuthorHandle}
                postId={postId}
                replyDrafts={replyDrafts}
                setActiveReplyId={setActiveReplyId}
                submitReply={submitReply}
                deleteComment={deleteComment}
                toggleReplies={toggleReplies}
                updateReplyDraft={updateReplyDraft}
              />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function DropsView({
  drops,
  dropBody,
  setDropBody,
  dropImageName,
  dropError,
  selectDropImage,
  clearDropImage,
  focusedDropId,
  createDrop,
  openReport,
}: {
  drops: Drop[];
  dropBody: string;
  setDropBody: (value: string) => void;
  dropImage: string;
  dropImageName: string;
  dropError: string;
  selectDropImage: (event: ChangeEvent<HTMLInputElement>) => void;
  clearDropImage: () => void;
  focusedDropId: number | null;
  createDrop: (event: FormEvent) => void;
  openReport: (target: string) => void;
}) {
  useEffect(() => {
    if (!focusedDropId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`drop-${focusedDropId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [focusedDropId]);

  return (
    <div className="viewStack">
      <form className="dropComposer" onSubmit={createDrop}>
        <div>
          <p className="eyebrow">Expires in 24h</p>
          <h2>Start a campus drop</h2>
        </div>
        <textarea
          value={dropBody}
          onChange={(event) => setDropBody(event.target.value)}
          placeholder="A quick moment, announcement, or chaos report..."
          rows={3}
        />
        <MediaFilePicker
          id="drop-photo-file"
          label="Add photo from device"
          accept="image/*"
          fileName={dropImageName}
          icon="image"
          onChange={selectDropImage}
          onClear={clearDropImage}
        />
        {dropError ? <p className="composerError">{dropError}</p> : null}
        <button className="primaryButton" type="submit">
          <Plus size={17} />
          Add drop
        </button>
      </form>
      <section className="dropGrid">
        {drops.map((drop) => (
          <article
            className={[
              drop.image ? "dropCard withImage" : "dropCard",
              focusedDropId === drop.id ? "focusedDrop" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            id={`drop-${drop.id}`}
            key={drop.id}
          >
            {drop.image ? <img src={drop.image} alt={drop.body} /> : null}
            <div className="dropCardContent">
              <div className="dropCardTop">
                <Avatar initials={drop.author.avatar} image={drop.author.photo} />
                <button className="iconButton" title="Report drop" onClick={() => openReport(`Drop by @${drop.author.handle}`)}>
                  <CircleAlert size={17} />
                </button>
              </div>
              <p>{drop.body}</p>
              <div className="dropMeta">
                <span>{drop.expiresIn} left</span>
                <span>{drop.viewers} views</span>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function VideosView({
  posts,
  currentStudent,
  following,
  toggleFollow,
  userReactions,
  commentsByPost,
  openComments,
  commentDrafts,
  replyDrafts,
  activeReplyId,
  collapsedReplies,
  videoBody,
  setVideoBody,
  videoMood,
  setVideoMood,
  videoFileName,
  selectVideo,
  clearVideo,
  videoError,
  createVideo,
  reactToPost,
  toggleComments,
  updateCommentDraft,
  submitComment,
  updateReplyDraft,
  submitReply,
  deletePost,
  deleteComment,
  canModerate,
  setActiveReplyId,
  toggleReplies,
  openReport,
}: {
  posts: Post[];
  currentStudent: Student;
  following: Set<string>;
  toggleFollow: (targetHandle: string) => void;
  userReactions: Record<number, ReactionKey[]>;
  commentsByPost: Record<number, PostComment[]>;
  openComments: Set<number>;
  commentDrafts: Record<number, string>;
  replyDrafts: Record<string, string>;
  activeReplyId: string | null;
  collapsedReplies: Set<string>;
  videoBody: string;
  setVideoBody: (value: string) => void;
  videoMood: string;
  setVideoMood: (value: string) => void;
  videoUrl: string;
  videoFileName: string;
  selectVideo: (event: ChangeEvent<HTMLInputElement>) => void;
  clearVideo: () => void;
  videoError: string;
  createVideo: (event: FormEvent) => void;
  reactToPost: (postId: number, key: ReactionKey) => void;
  toggleComments: (postId: number) => void;
  updateCommentDraft: (postId: number, value: string) => void;
  submitComment: (event: FormEvent, postId: number) => void;
  updateReplyDraft: (commentId: string, value: string) => void;
  submitReply: (event: FormEvent, postId: number, parentId: string) => void;
  deletePost: (postId: number) => void;
  deleteComment: (postId: number, commentId: string) => void;
  canModerate: boolean;
  setActiveReplyId: (commentId: string | null) => void;
  toggleReplies: (commentId: string) => void;
  openReport: (target: string) => void;
}) {
  return (
    <div className="viewStack">
      <form className="composer videoComposer" onSubmit={createVideo}>
        <Avatar initials={currentStudent.avatar} />
        <div className="composerBody">
          <MediaFilePicker
            id="video-file"
            label="Choose video from device"
            accept="video/*"
            fileName={videoFileName}
            icon="video"
            onChange={selectVideo}
            onClear={clearVideo}
          />
          <textarea
            value={videoBody}
            onChange={(event) => setVideoBody(event.target.value)}
            placeholder="Caption this video for campus..."
            rows={3}
          />
          <div className={videoError ? "moodInput invalid" : "moodInput"}>
            <label htmlFor="videoMood">Mood</label>
            <input
              id="videoMood"
              value={videoMood}
              onChange={(event) => setVideoMood(event.target.value)}
              placeholder="cinematic ðŸŽ¬"
              aria-invalid={videoError ? "true" : "false"}
            />
          </div>
          {videoError ? <p className="composerError">{videoError}</p> : null}
          <div className="composerActions">
            <div className="chipRow">
              <span className="tinyChip">Videos only</span>
              <span className="tinyChip">Hidden from feed</span>
            </div>
            <button className="primaryButton" type="submit">
              <Send size={17} />
              Post video
            </button>
          </div>
        </div>
      </form>

      <section className="feedList" aria-label="Video feed">
        {posts.length ? (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              userReactions={userReactions[post.id] ?? []}
            comments={commentsByPost[post.id] ?? []}
            currentStudent={currentStudent}
            following={following}
            toggleFollow={toggleFollow}
            commentsOpen={openComments.has(post.id)}
              commentDraft={commentDrafts[post.id] ?? ""}
              replyDrafts={replyDrafts}
              activeReplyId={activeReplyId}
              collapsedReplies={collapsedReplies}
              reactToPost={reactToPost}
              toggleComments={toggleComments}
              updateCommentDraft={updateCommentDraft}
              submitComment={submitComment}
              updateReplyDraft={updateReplyDraft}
              submitReply={submitReply}
              deletePost={deletePost}
              deleteComment={deleteComment}
            setActiveReplyId={setActiveReplyId}
            toggleReplies={toggleReplies}
            canModerate={canModerate}
            openReport={openReport}
          />
          ))
        ) : (
          <div className="emptyComments">No videos yet. The first campus clip can start here.</div>
        )}
      </section>
    </div>
  );
}

function TrendsView({
  trends,
  setSelectedTrend,
  setActiveView,
}: {
  trends: Trend[];
  setSelectedTrend: (tag: string) => void;
  setActiveView: (view: View) => void;
}) {
  return (
    <section className="trendGrid">
      {trends.map((trend, index) => (
        <article className="trendCard" key={trend.tag}>
          <div className="rank">{index + 1}</div>
          <div>
            <p className="eyebrow">{trend.scope}</p>
            <h2>{trend.tag}</h2>
            <span>{trend.posts} yeps in the last hour</span>
          </div>
          <div className="heatMeter" aria-label={`${trend.heat}% heat`}>
            <span style={{ width: `${trend.heat}%` }} />
          </div>
          <button
            className="ghostButton"
            onClick={() => {
              setSelectedTrend(trend.tag);
              setActiveView("home");
            }}
          >
            Open trend
          </button>
        </article>
      ))}
    </section>
  );
}

function DirectView({
  conversations,
  currentStudent,
  activeConversationId,
  setActiveConversationId,
  draft,
  setDraft,
  photo,
  photoName,
  selectPhoto,
  clearPhoto,
  recipient,
  setRecipient,
  starterBody,
  setStarterBody,
  starterPhoto,
  starterPhotoName,
  selectStarterPhoto,
  clearStarterPhoto,
  groupMode,
  setGroupMode,
  groupName,
  setGroupName,
  groupAvatar,
  groupAvatarName,
  selectGroupAvatar,
  clearGroupAvatar,
  directTab,
  setDirectTab,
  directError,
  loadMessages,
  trimMessages,
  submitMessage,
  submitStarter,
}: {
  conversations: DirectConversation[];
  currentStudent: Student;
  activeConversationId: string | null;
  setActiveConversationId: (id: string) => void;
  draft: string;
  setDraft: (value: string) => void;
  photo: string;
  photoName: string;
  selectPhoto: (event: ChangeEvent<HTMLInputElement>) => void;
  clearPhoto: () => void;
  recipient: string;
  setRecipient: (value: string) => void;
  starterBody: string;
  setStarterBody: (value: string) => void;
  starterPhoto: string;
  starterPhotoName: string;
  selectStarterPhoto: (event: ChangeEvent<HTMLInputElement>) => void;
  clearStarterPhoto: () => void;
  groupMode: boolean;
  setGroupMode: (value: boolean) => void;
  groupName: string;
  setGroupName: (value: string) => void;
  groupAvatar: string;
  groupAvatarName: string;
  selectGroupAvatar: (event: ChangeEvent<HTMLInputElement>) => void;
  clearGroupAvatar: () => void;
  directTab: "social" | "lostfound";
  setDirectTab: (tab: "social" | "lostfound") => void;
  directError: string;
  loadMessages: (conversationId: string, direction: DirectMessageDirection) => Promise<void>;
  trimMessages: (conversationId: string, centerMessageId: string) => void;
  submitMessage: (event: FormEvent, conversationId: string) => void;
  submitStarter: (event: FormEvent) => void;
}) {
  const visibleConversations = conversations.filter((conversation) =>
    directTab === "lostfound" ? conversation.kind === "lostfound" : (conversation.kind ?? "social") === "social",
  );
  const activeConversation =
    visibleConversations.find((conversation) => conversation.id === activeConversationId) ?? visibleConversations[0];
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const activeConversationRef = useRef<string | null>(null);
  const isNearBottomRef = useRef(true);
  const edgeLoadingRef = useRef<Record<string, boolean>>({});
  const unloadTimerRef = useRef<number | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const getConversationTitle = (conversation: DirectConversation) => {
    if (conversation.isGroup) {
      return conversation.title || conversation.participants
        .filter((participant) => participant.handle !== currentStudent.handle)
        .map((participant) => `@${participant.handle}`)
        .join(", ");
    }

    const peer =
      conversation.participants.find((participant) => participant.handle !== currentStudent.handle) ??
      conversation.participants[0];
    return `@${peer.handle}`;
  };
  const getConversationAvatar = (conversation: DirectConversation) => {
    if (conversation.isGroup) return initialsFromText(conversation.title || "Group");
    return (
      conversation.participants.find((participant) => participant.handle !== currentStudent.handle)?.avatar ??
      conversation.participants[0]?.avatar ??
      "YP"
    );
  };
  const getConversationAvatarImage = (conversation: DirectConversation) => {
    if (conversation.isGroup) return conversation.avatar;
    return conversation.participants.find((participant) => participant.handle !== currentStudent.handle)?.photo;
  };
  const activeTitle = activeConversation ? getConversationTitle(activeConversation) : "campus";
  const activeMessageTotal = activeConversation?.messageWindow?.total ?? activeConversation?.messages.length ?? 0;
  const directCounts = {
    social: conversations.filter((conversation) => (conversation.kind ?? "social") === "social").length,
    lostfound: conversations.filter((conversation) => conversation.kind === "lostfound").length,
  };
  const activeMedia = activeConversation?.messages.filter((message) => message.image) ?? [];

  const getCenterMessageId = () => {
    const container = messagesRef.current;
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();
    const targetY = containerRect.top + containerRect.height / 2;
    let closestId: string | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    container.querySelectorAll<HTMLElement>("[data-message-id]").forEach((element) => {
      const rect = element.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const distance = Math.abs(midpoint - targetY);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestId = element.dataset.messageId ?? null;
      }
    });

    return closestId;
  };

  const scheduleUnloadFarMessages = () => {
    if (!activeConversation) return;
    const centerMessageId = getCenterMessageId();
    if (!centerMessageId) return;

    if (unloadTimerRef.current) {
      window.clearTimeout(unloadTimerRef.current);
    }
    unloadTimerRef.current = window.setTimeout(() => {
      if (!activeConversationRef.current) return;
      trimMessages(activeConversationRef.current, centerMessageId);
    }, 4 * 60 * 1000);
  };

  const requestMessageEdge = async (direction: DirectMessageDirection) => {
    if (!activeConversation) return;
    const hasMore =
      direction === "before"
        ? activeConversation.messageWindow?.hasMoreBefore
        : activeConversation.messageWindow?.hasMoreAfter;
    if (!hasMore) return;

    const key = `${activeConversation.id}:${direction}`;
    if (edgeLoadingRef.current[key]) return;

    const container = messagesRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    const previousTop = container?.scrollTop ?? 0;
    edgeLoadingRef.current[key] = true;
    await loadMessages(activeConversation.id, direction);
    window.requestAnimationFrame(() => {
      const nextContainer = messagesRef.current;
      if (direction === "before" && nextContainer) {
        nextContainer.scrollTop = nextContainer.scrollHeight - previousHeight + previousTop;
      }
      edgeLoadingRef.current[key] = false;
    });
  };

  const handleDirectScroll = () => {
    const container = messagesRef.current;
    if (!container) return;

    const bottomDistance = container.scrollHeight - container.scrollTop - container.clientHeight;
    isNearBottomRef.current = bottomDistance < 140;

    if (container.scrollTop < 180) {
      requestMessageEdge("before");
    }
    if (bottomDistance < 180) {
      requestMessageEdge("after");
    }

    scheduleUnloadFarMessages();
  };

  useEffect(() => {
    if (!activeConversation?.id) return;
    const conversationChanged = activeConversationRef.current !== activeConversation.id;
    activeConversationRef.current = activeConversation.id;
    setShowGroupInfo(false);

    if (conversationChanged) {
      window.requestAnimationFrame(() => {
        const container = messagesRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
          isNearBottomRef.current = true;
        }
      });
    }
  }, [activeConversation?.id]);

  useEffect(() => {
    if (!activeConversation?.id || !isNearBottomRef.current) return;
    window.requestAnimationFrame(() => {
      const container = messagesRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }, [activeConversation?.id, activeConversation?.messages.length]);

  useEffect(
    () => () => {
      if (unloadTimerRef.current) {
        window.clearTimeout(unloadTimerRef.current);
      }
    },
    [],
  );

  return (
    <div className="directLayout">
      <aside className="directInbox">
        <div className="directPanelHeader">
          <div>
            <p className="eyebrow">Private signal</p>
            <h2>Directs</h2>
          </div>
          <MessageCircle size={20} />
        </div>

        <div className="directTabBar" aria-label="Direct sections">
          <button
            className={directTab === "social" ? "active" : ""}
            type="button"
            onClick={() => setDirectTab("social")}
          >
            Directs <span>{directCounts.social}</span>
          </button>
          <button
            className={directTab === "lostfound" ? "active" : ""}
            type="button"
            onClick={() => setDirectTab("lostfound")}
          >
            Lost+Found <span>{directCounts.lostfound}</span>
          </button>
        </div>

        {directTab === "social" ? (
          <form className="directStarter" onSubmit={submitStarter}>
          <label className="directModeToggle">
            <input
              type="checkbox"
              checked={groupMode}
              onChange={(event) => setGroupMode(event.target.checked)}
            />
            <span>Group direct</span>
          </label>
            {groupMode ? (
              <>
                <label>
                  <span>Group name</span>
                  <input
                    value={groupName}
                    onChange={(event) => setGroupName(event.target.value)}
                    placeholder="Squad name"
                  />
                </label>
                <MediaFilePicker
                  id="direct-group-avatar-file"
                  label="Group photo"
                  accept="image/*"
                  fileName={groupAvatarName}
                  icon="image"
                  onChange={selectGroupAvatar}
                  onClear={clearGroupAvatar}
                />
              </>
            ) : null}
          <label>
            <span>{groupMode ? "Start with" : "Start with"}</span>
            <input
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder={groupMode ? "@lia.codes, @rafanunes" : "@handle"}
            />
          </label>
          <textarea
            value={starterBody}
            onChange={(event) => setStarterBody(event.target.value)}
            placeholder="Drop the first message..."
            rows={3}
          />
          <MediaFilePicker
            id="direct-starter-photo-file"
            label="Add photo from device"
            accept="image/*"
            fileName={starterPhotoName}
            icon="image"
            onChange={selectStarterPhoto}
            onClear={clearStarterPhoto}
          />
          <button className="primaryButton" type="submit">
            <Send size={16} />
            {groupMode ? "Start group" : "Start direct"}
          </button>
          </form>
        ) : (
          <div className="directStarter directLostFoundHint">
            <p>Lost+Found contacts appear here after someone uses a contact button on an item.</p>
          </div>
        )}

        <div className="directConversationList">
          {visibleConversations.map((conversation) => {
            const lastMessage = conversation.lastMessage ?? conversation.messages[conversation.messages.length - 1];
            const unread = conversation.unreadBy.includes(currentStudent.handle);
            const title = getConversationTitle(conversation);

            return (
              <button
                className={conversation.id === activeConversation?.id ? "directConversation active" : "directConversation"}
                key={conversation.id}
                type="button"
                onClick={() => setActiveConversationId(conversation.id)}
              >
                <Avatar initials={getConversationAvatar(conversation)} image={getConversationAvatarImage(conversation)} />
                <span>
                  <strong>{title}</strong>
                  <small>{lastMessage?.body || (lastMessage?.image ? "Photo" : "No messages yet")}</small>
                </span>
                {unread ? <i aria-label="Unread direct" /> : null}
              </button>
            );
          })}
          {!visibleConversations.length ? (
            <div className="directEmptyList">
              {directTab === "lostfound" ? "No Lost+Found contacts yet." : "No directs in this tab yet."}
            </div>
          ) : null}
        </div>
      </aside>

      <section className="directThread">
        {activeConversation ? (
          <>
            <button
              className={activeConversation.isGroup ? "directThreadHeader clickable" : "directThreadHeader"}
              type="button"
              onClick={() => {
                if (activeConversation.isGroup) setShowGroupInfo((current) => !current);
              }}
            >
              <Avatar initials={getConversationAvatar(activeConversation)} image={getConversationAvatarImage(activeConversation)} />
              <div>
                <p className="eyebrow">{activeConversation.isGroup ? "Group direct" : "Yep to Yep"}</p>
                <h2>{activeTitle}</h2>
                <span>
                  {activeConversation.participants.length} people / {activeMessageTotal} messages
                </span>
              </div>
            </button>

            {showGroupInfo && activeConversation.isGroup ? (
              <div className="directInfoPanel">
                <section>
                  <h3>Members</h3>
                  <div className="directInfoMembers">
                    {activeConversation.participants.map((participant) => (
                      <div className="directInfoMember" key={participant.handle}>
                        <Avatar initials={participant.avatar} image={participant.photo} />
                        <span>
                          <strong>{participant.name}</strong>
                          <small>@{participant.handle}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
                <section>
                  <h3>Media</h3>
                  {activeMedia.length ? (
                    <div className="directMediaGrid">
                      {activeMedia.map((message) => (
                        <img src={message.image} alt="" key={message.id} />
                      ))}
                    </div>
                  ) : (
                    <p>No media sent yet.</p>
                  )}
                </section>
              </div>
            ) : (
              <div className="directMessages" onScroll={handleDirectScroll} ref={messagesRef}>
              {activeConversation.messages.map((message) => {
                const mine = message.author.handle === currentStudent.handle;

                return (
                  <div
                    className={mine ? "directMessage mine" : "directMessage"}
                    data-message-id={message.id}
                    key={message.id}
                  >
                    <div>
                      <span>
                        @{message.author.handle} · {message.time}
                      </span>
                      {message.body ? <p>{message.body}</p> : null}
                      {message.image ? <img className="directPhoto" src={message.image} alt="" /> : null}
                    </div>
                  </div>
                );
              })}
              </div>
            )}

            {!showGroupInfo ? (
              <form className="directComposer" onSubmit={(event) => submitMessage(event, activeConversation.id)}>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={`Message ${activeTitle}`}
              />
              <MediaFilePicker
                id="direct-photo-file"
                label="Photo"
                accept="image/*"
                fileName={photoName}
                icon="image"
                onChange={selectPhoto}
                onClear={clearPhoto}
              />
              <button className="primaryButton" type="submit">
                <Send size={16} />
                Send
              </button>
              </form>
            ) : null}
          </>
        ) : (
          <div className="directEmpty">
            <MessageCircle size={32} />
            <h2>No directs yet</h2>
            <p>Start with an @handle and make the first move.</p>
          </div>
        )}

        {directError ? <p className="composerError">{directError}</p> : null}
      </section>
    </div>
  );
}

function CommunitiesView({
  communities,
  posts,
  currentStudent,
  userReactions,
  commentsByPost,
  openComments,
  commentDrafts,
  replyDrafts,
  activeReplyId,
  collapsedReplies,
  communityMembers,
  activeCommunityId,
  setActiveCommunityId,
  joinedCommunities,
  toggleCommunity,
  communityDraft,
  updateCommunityDraft,
  selectCommunityAvatar,
  clearCommunityAvatar,
  submitCommunity,
  communityCreateError,
  communityPostBody,
  setCommunityPostBody,
  communityPostMood,
  setCommunityPostMood,
  communityPostError,
  communityPostEverywhere,
  setCommunityPostEverywhere,
  submitCommunityPost,
  reactToPost,
  toggleComments,
  updateCommentDraft,
  submitComment,
  updateReplyDraft,
  submitReply,
  deletePost,
  deleteComment,
  deleteCommunity,
  setActiveReplyId,
  toggleReplies,
  following,
  toggleFollow,
  canModerate,
  openReport,
}: {
  communities: Community[];
  posts: Post[];
  currentStudent: Student;
  userReactions: Record<number, ReactionKey[]>;
  commentsByPost: Record<number, PostComment[]>;
  openComments: Set<number>;
  commentDrafts: Record<number, string>;
  replyDrafts: Record<string, string>;
  activeReplyId: string | null;
  collapsedReplies: Set<string>;
  communityMembers: Record<number, Student[]>;
  activeCommunityId: number | null;
  setActiveCommunityId: (id: number) => void;
  joinedCommunities: Set<number>;
  toggleCommunity: (id: number) => void;
  communityDraft: { name: string; category: string; description: string; accent: string; avatar: string; avatarName: string };
  updateCommunityDraft: (
    updates: Partial<{ name: string; category: string; description: string; accent: string; avatar: string; avatarName: string }>,
  ) => void;
  selectCommunityAvatar: (event: ChangeEvent<HTMLInputElement>) => void;
  clearCommunityAvatar: () => void;
  submitCommunity: (event: FormEvent) => void;
  communityCreateError: string;
  communityPostBody: string;
  setCommunityPostBody: (value: string) => void;
  communityPostMood: string;
  setCommunityPostMood: (value: string) => void;
  communityPostError: string;
  communityPostEverywhere: boolean;
  setCommunityPostEverywhere: (value: boolean) => void;
  submitCommunityPost: (event: FormEvent, communityId: number) => void;
  reactToPost: (postId: number, key: ReactionKey) => void;
  toggleComments: (postId: number) => void;
  updateCommentDraft: (postId: number, value: string) => void;
  submitComment: (event: FormEvent, postId: number) => void;
  updateReplyDraft: (commentId: string, value: string) => void;
  submitReply: (event: FormEvent, postId: number, parentId: string) => void;
  deletePost: (postId: number) => void;
  deleteComment: (postId: number, commentId: string) => void;
  deleteCommunity: (communityId: number) => void;
  setActiveReplyId: (commentId: string | null) => void;
  toggleReplies: (commentId: string) => void;
  following: Set<string>;
  toggleFollow: (targetHandle: string) => void;
  canModerate: boolean;
  openReport: (target: string) => void;
}) {
  const activeCommunity = communities.find((community) => community.id === activeCommunityId);
  const activeMembers = activeCommunity ? communityMembers[activeCommunity.id] ?? [] : [];
  const activePosts = activeCommunity
    ? posts.filter(
        (post) => post.communityId === activeCommunity.id || (!post.communityId && post.community === activeCommunity.name),
      )
    : [];
  const hasCreatedCommunity = communities.some((community) => community.creator.handle === currentStudent.handle);
  const isCreator = activeCommunity?.creator.handle === currentStudent.handle;
  const isJoined = activeCommunity ? joinedCommunities.has(activeCommunity.id) : false;
  const canEnter = Boolean(activeCommunity && (isJoined || isCreator));

  return (
    <div className="communityHub">
      <form className="communityCreator" onSubmit={submitCommunity}>
        <div>
          <p className="eyebrow">Create a room</p>
          <h2>Your community</h2>
        </div>
        {hasCreatedCommunity ? (
          <p className="communityRule">You already created your one community.</p>
        ) : (
          <>
            <input
              value={communityDraft.name}
              onChange={(event) => updateCommunityDraft({ name: event.target.value })}
              placeholder="Community name"
            />
            <input
              value={communityDraft.category}
              onChange={(event) => updateCommunityDraft({ category: event.target.value })}
              placeholder="Category"
            />
            <textarea
              value={communityDraft.description}
              onChange={(event) => updateCommunityDraft({ description: event.target.value })}
              placeholder="What is this community for?"
              rows={3}
            />
            <MediaFilePicker
              id="community-avatar-file"
              label="Community photo"
              accept="image/*"
              fileName={communityDraft.avatarName}
              icon="image"
              onChange={selectCommunityAvatar}
              onClear={clearCommunityAvatar}
            />
            <div className="communityAccentPicker">
              {["#00b8d9", "#ff2d75", "#ffe94d", "#8bd346"].map((color) => (
                <button
                  className={communityDraft.accent === color ? "active" : ""}
                  key={color}
                  type="button"
                  onClick={() => updateCommunityDraft({ accent: color })}
                  title={color}
                >
                  <span style={{ background: color }} />
                </button>
              ))}
            </div>
            {communityCreateError ? <p className="composerError">{communityCreateError}</p> : null}
            <button className="primaryButton" type="submit">
              <Plus size={16} />
              Create community
            </button>
          </>
        )}
      </form>

      <section className="communityGrid" aria-label="Communities">
        {communities.map((community) => (
          <CommunityCard
            active={activeCommunity?.id === community.id}
            community={community}
            joined={joinedCommunities.has(community.id) || community.creator.handle === currentStudent.handle}
            key={community.id}
            openCommunity={setActiveCommunityId}
            toggleCommunity={toggleCommunity}
            deleteCommunity={deleteCommunity}
            canDelete={canModerate || community.creator.handle === currentStudent.handle}
          />
        ))}
      </section>

      {!activeCommunity ? (
        <div className="communityPickPrompt">
          <UsersRound size={22} />
          Pick a community card to open its room.
        </div>
      ) : null}

      {activeCommunity ? (
        <section className="communityRoom">
          <div className="communityHero" style={{ "--community-accent": activeCommunity.accent } as CSSProperties}>
            <div>
              <p className="eyebrow">{activeCommunity.category}</p>
              <h2>{activeCommunity.name}</h2>
              <p>{activeCommunity.description}</p>
              <div className="communityMeta">
                <span>Created by @{activeCommunity.creator.handle}</span>
                <span>{activeCommunity.members} members</span>
                <span>{activePosts.length} posts</span>
              </div>
            </div>
            <div className="communityHeroActions">
              <Avatar initials={initialsFromText(activeCommunity.name)} image={activeCommunity.avatar} />
              <button
                className={isJoined || isCreator ? "joinedButton" : "primaryButton"}
                type="button"
                onClick={() => toggleCommunity(activeCommunity.id)}
              >
                {isJoined || isCreator ? "Joined" : "Join"}
              </button>
              {canModerate || isCreator ? (
                <button className="iconButton dangerIcon" type="button" title="Delete community" onClick={() => deleteCommunity(activeCommunity.id)}>
                  <Trash2 size={17} />
                </button>
              ) : null}
            </div>
          </div>

          {canEnter ? (
          <div className="communityRoomGrid">
            <div className="communityFeed">
              <form className="composer communityPostComposer" onSubmit={(event) => submitCommunityPost(event, activeCommunity.id)}>
                  <Avatar initials={currentStudent.avatar} image={currentStudent.photo} />
                  <div className="composerBody">
                    <textarea
                      value={communityPostBody}
                      onChange={(event) => setCommunityPostBody(event.target.value)}
                      placeholder={`Post to ${activeCommunity.name}`}
                      rows={3}
                    />
                    <div className={communityPostError ? "moodInput invalid" : "moodInput"}>
                      <label htmlFor="communityPostMood">Mood</label>
                      <input
                        id="communityPostMood"
                        value={communityPostMood}
                        onChange={(event) => setCommunityPostMood(event.target.value)}
                        placeholder="locked-in 🔥"
                        aria-invalid={communityPostError ? "true" : "false"}
                      />
                    </div>
                    <label className="communityPublishToggle">
                      <input
                        type="checkbox"
                        checked={communityPostEverywhere}
                        onChange={(event) => setCommunityPostEverywhere(event.target.checked)}
                      />
                      <span>Also share on campus feed</span>
                    </label>
                    {communityPostError ? <p className="composerError">{communityPostError}</p> : null}
                    <div className="composerActions">
                      <span className="tinyChip">#{activeCommunity.name.replace(/\s+/g, "")}</span>
                      <button className="primaryButton" type="submit">
                        <Send size={17} />
                        Post
                      </button>
                    </div>
                  </div>
                </form>

              {activePosts.length ? (
                <section className="feedList" aria-label={`${activeCommunity.name} feed`}>
                  {activePosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      userReactions={userReactions[post.id] ?? []}
                      comments={commentsByPost[post.id] ?? []}
                      currentStudent={currentStudent}
                      following={following}
                      toggleFollow={toggleFollow}
                      commentsOpen={openComments.has(post.id)}
                      commentDraft={commentDrafts[post.id] ?? ""}
                      replyDrafts={replyDrafts}
                      activeReplyId={activeReplyId}
                      collapsedReplies={collapsedReplies}
                      reactToPost={reactToPost}
                      toggleComments={toggleComments}
                      updateCommentDraft={updateCommentDraft}
                      submitComment={submitComment}
                      updateReplyDraft={updateReplyDraft}
                      submitReply={submitReply}
                      deletePost={deletePost}
                      deleteComment={deleteComment}
                      setActiveReplyId={setActiveReplyId}
                      toggleReplies={toggleReplies}
                      canModerate={canModerate}
                      openReport={openReport}
                    />
                  ))}
                </section>
              ) : (
                <div className="emptyComments">No posts in this community yet.</div>
              )}
            </div>

            <aside className="communityMembersPanel">
              <h2>Members</h2>
              <div className="communityMemberList">
                {activeMembers.map((member) => (
                  <div className="communityMember" key={member.handle}>
                    <Avatar initials={member.avatar} image={member.photo} />
                    <span>
                      <strong>{member.name}</strong>
                      <small>@{member.handle}</small>
                    </span>
                    {member.handle !== currentStudent.handle ? (
                      <button
                        className={following.has(member.handle) ? "followButton following" : "followButton"}
                        type="button"
                        onClick={() => toggleFollow(member.handle)}
                      >
                        {following.has(member.handle) ? <UserCheck size={15} /> : <UserPlus size={15} />}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </aside>
          </div>
          ) : (
            <div className="communityLockedRoom">
              <LockKeyhole size={22} />
              <h2>Join to see the feed and members</h2>
              <p>This room opens after you join the community.</p>
              <button className="primaryButton" type="button" onClick={() => toggleCommunity(activeCommunity.id)}>
                Join community
              </button>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function CommunityCard({
  community,
  joined,
  active,
  openCommunity,
  toggleCommunity,
  deleteCommunity,
  canDelete,
}: {
  community: Community;
  joined: boolean;
  active?: boolean;
  openCommunity: (id: number) => void;
  toggleCommunity: (id: number) => void;
  deleteCommunity: (id: number) => void;
  canDelete: boolean;
}) {
  return (
    <article
      className={active ? "communityCard active" : "communityCard"}
      onClick={() => openCommunity(community.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          openCommunity(community.id);
        }
      }}
      role="button"
      style={{ borderTopColor: community.accent }}
      tabIndex={0}
    >
      <div className="communityHeader">
        <div className="communityCardTitle">
          <Avatar initials={initialsFromText(community.name)} image={community.avatar} />
          <div>
          <p className="eyebrow">{community.category}</p>
          <h2>{community.name}</h2>
          </div>
        </div>
        <div className="communityCardActions">
          <button
            className={joined ? "joinedButton" : "ghostButton"}
            onClick={(event) => {
              event.stopPropagation();
              toggleCommunity(community.id);
            }}
            type="button"
          >
            {joined ? "Joined" : "Join"}
          </button>
          {canDelete ? (
            <button
              className="iconButton dangerIcon"
              onClick={(event) => {
                event.stopPropagation();
                deleteCommunity(community.id);
              }}
              title="Delete community"
              type="button"
            >
              <Trash2 size={16} />
            </button>
          ) : null}
        </div>
      </div>
      <p>{community.description}</p>
      <div className="communityMeta">
        <span>{community.members} members</span>
        <span>Top: {community.topPost}</span>
      </div>
    </article>
  );
}

function EventsView({
  events,
  currentStudent,
  rsvps,
  eventVotes,
  authorStats,
  postingStatus,
  eventForm,
  eventFormError,
  editingEventId,
  updateEventForm,
  submitEvent,
  cancelEditing,
  startEditingEvent,
  voteOnEvent,
  toggleRsvp,
  deleteEvent,
  canModerate,
}: {
  events: CampusEvent[];
  currentStudent: Student;
  rsvps: Set<number>;
  eventVotes: Record<number, EventVoteChoice>;
  authorStats: Record<string, EventAuthorStats>;
  postingStatus: EventPostingStatus;
  eventForm: EventFormState;
  eventFormError: string;
  editingEventId: number | null;
  updateEventForm: (updates: Partial<EventFormState>) => void;
  submitEvent: (event: FormEvent) => void;
  cancelEditing: () => void;
  startEditingEvent: (event: CampusEvent) => void;
  voteOnEvent: (eventId: number, choice: EventVoteChoice) => void;
  toggleRsvp: (id: number) => void;
  deleteEvent: (eventId: number) => void;
  canModerate: boolean;
}) {
  const sortedEvents = [...events].sort((left, right) => {
    const leftPast = isEventPast(left);
    const rightPast = isEventPast(right);
    if (leftPast !== rightPast) return leftPast ? 1 : -1;
    return new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
  });

  return (
    <div className="eventsStack">
      <form className="eventComposer" onSubmit={submitEvent}>
        <div className="eventComposerHeader">
          <div>
            <p className="eyebrow">{editingEventId ? "Edit event" : "Post an event"}</p>
            <h2>{editingEventId ? "Dates change. Receipts stay." : "Make campus plans official"}</h2>
          </div>
          <span className={postingStatus.isBlocked ? "eventRuleBadge danger" : "eventRuleBadge"}>
            {postingStatus.isBlocked
              ? `Paused until ${formatBlockDate(postingStatus.blockedUntil)}`
              : `${postingStatus.remainingThisWeek}/${EVENT_WEEKLY_LIMIT} slots left this week`}
          </span>
        </div>

        <div className="eventFormGrid">
          <label>
            Title
            <input
              value={eventForm.title}
              onChange={(event) => updateEventForm({ title: event.target.value })}
              placeholder="Open mic no patio"
            />
          </label>
          <label>
            Category
            <input
              value={eventForm.category}
              onChange={(event) => updateEventForm({ category: event.target.value })}
              placeholder="Culture"
            />
          </label>
          <label>
            Location
            <input
              value={eventForm.location}
              onChange={(event) => updateEventForm({ location: event.target.value })}
              placeholder="Patio central"
            />
          </label>
          <label>
            Date
            <input
              type="date"
              value={eventForm.date}
              onChange={(event) => updateEventForm({ date: event.target.value })}
            />
          </label>
          <label>
            Time
            <input
              type="time"
              value={eventForm.time}
              onChange={(event) => updateEventForm({ time: event.target.value })}
            />
          </label>
        </div>

        {eventFormError ? <p className="composerError">{eventFormError}</p> : null}

        <div className="eventRuleStrip">
          <span>Max 2 edits after posting</span>
          <span>Voting opens after the event</span>
          <span>3 fake events = 1 month paused</span>
        </div>

        <div className="eventComposerActions">
          {editingEventId ? (
            <button className="ghostButton" type="button" onClick={cancelEditing}>
              Cancel
            </button>
          ) : null}
          <button className="primaryButton" type="submit">
            {editingEventId ? <Save size={17} /> : <Plus size={17} />}
            {editingEventId ? "Save edit" : "Post event"}
          </button>
        </div>
      </form>

      <section className="eventList">
        {sortedEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            currentStudent={currentStudent}
            stats={authorStats[event.author.handle] ?? { posted: 1, real: 0, fake: 0 }}
            isGoing={rsvps.has(event.id)}
            userVote={eventVotes[event.id]}
            toggleRsvp={toggleRsvp}
            startEditingEvent={startEditingEvent}
            voteOnEvent={voteOnEvent}
            deleteEvent={deleteEvent}
            canModerate={canModerate}
          />
        ))}
      </section>
    </div>
  );
}

function EventCard({
  event,
  currentStudent,
  stats,
  isGoing,
  userVote,
  toggleRsvp,
  startEditingEvent,
  voteOnEvent,
  deleteEvent,
  canModerate,
}: {
  event: CampusEvent;
  currentStudent: Student;
  stats: EventAuthorStats;
  isGoing: boolean;
  userVote?: EventVoteChoice;
  toggleRsvp: (id: number) => void;
  startEditingEvent: (event: CampusEvent) => void;
  voteOnEvent: (eventId: number, choice: EventVoteChoice) => void;
  deleteEvent: (eventId: number) => void;
  canModerate: boolean;
}) {
  const eventPast = isEventPast(event);
  const verdict = getEventVerdict(event);
  const editsLeft = Math.max(0, EVENT_EDIT_LIMIT - event.editCount);
  const canEdit = event.author.handle === currentStudent.handle && !eventPast && editsLeft > 0;
  const canDelete = event.author.handle === currentStudent.handle || canModerate;
  const verdictLabel =
    verdict === "real"
      ? "Community says it happened"
      : verdict === "fake"
        ? "Flagged as fake"
        : eventPast
          ? "Needs verification"
          : "Upcoming";

  return (
    <article className={eventPast ? "eventCard pastEvent" : "eventCard"}>
      <div className="eventDate">
        <CalendarDays size={20} />
        <span>{event.date}</span>
      </div>
      <div className="eventContent">
        <p className="eyebrow">{event.category}</p>
        <h2>{event.title}</h2>
        <span>{event.location}</span>
        <div className="eventAuthorLine">
          <AtSign size={15} />
          <strong>{event.author.handle}</strong>
          <span>{event.editCount}/{EVENT_EDIT_LIMIT} edits used</span>
        </div>
        <div className="eventTrustRow">
          <span>{stats.posted} posted</span>
          <span>{stats.real} real</span>
          <span className={stats.fake >= EVENT_FALSE_BLOCK_THRESHOLD ? "dangerText" : undefined}>
            {stats.fake} fake
          </span>
          {stats.blockedUntil ? <span>paused until {formatBlockDate(stats.blockedUntil)}</span> : null}
        </div>
        <div className="eventVoting">
          <span className={`eventVerdict ${verdict}`}>{verdictLabel}</span>
          {eventPast ? (
            <div className="eventVoteButtons">
              <button
                className={userVote === "true" ? "joinedButton" : "ghostButton"}
                type="button"
                onClick={() => voteOnEvent(event.id, "true")}
              >
                <Check size={16} />
                Happened {event.trueVotes}
              </button>
              <button
                className={userVote === "false" ? "joinedButton dangerButton" : "ghostButton"}
                type="button"
                onClick={() => voteOnEvent(event.id, "false")}
              >
                <X size={16} />
                Fake {event.falseVotes}
              </button>
            </div>
          ) : (
            <span className="eventVoteLocked">Voting opens after event time</span>
          )}
        </div>
      </div>
      <div className="eventActions">
        <span>{event.attendees} going</span>
        {!eventPast ? (
          <button className={isGoing ? "joinedButton" : "ghostButton"} type="button" onClick={() => toggleRsvp(event.id)}>
            {isGoing ? "Going" : "RSVP"}
          </button>
        ) : null}
        {canEdit ? (
          <button className="ghostButton" type="button" onClick={() => startEditingEvent(event)}>
            <Pencil size={16} />
            Edit ({editsLeft})
          </button>
        ) : null}
        {canDelete ? (
          <button className="iconButton dangerIcon" type="button" title="Delete event" onClick={() => deleteEvent(event.id)}>
            <Trash2 size={17} />
          </button>
        ) : null}
      </div>
    </article>
  );
}

function StudyView({
  groups,
  joinedGroups,
  toggleGroup,
}: {
  groups: StudyGroup[];
  joinedGroups: Set<number>;
  toggleGroup: (id: number) => void;
}) {
  return (
    <section className="studyGrid">
      {groups.map((group) => (
        <StudyCard key={group.id} group={group} joined={joinedGroups.has(group.id)} toggleGroup={toggleGroup} />
      ))}
    </section>
  );
}

function StudyCard({
  group,
  joined,
  toggleGroup,
}: {
  group: StudyGroup;
  joined: boolean;
  toggleGroup: (id: number) => void;
}) {
  return (
    <article className="studyCard">
      <BookOpen size={24} />
      <h2>{group.subject}</h2>
      <p>
        Hosted by {group.host.name} · {group.time}
      </p>
      <span>{group.place}</span>
      <div className="studyFooter">
        <span>{group.seats - (joined ? 1 : 0)} seats left</span>
        <button className={joined ? "joinedButton" : "ghostButton"} onClick={() => toggleGroup(group.id)}>
          {joined ? "Joined" : "Join group"}
        </button>
      </div>
    </article>
  );
}

function LostFoundView({
  items,
  currentStudent,
  draft,
  setDraft,
  error,
  selectImage,
  clearImage,
  submitLostFound,
  contactDrafts,
  updateContactDraft,
  activeContactId,
  setActiveContactId,
  contactLostFound,
  deleteLostFound,
  canModerate,
}: {
  items: LostFound[];
  currentStudent: Student;
  draft: { status: "Lost" | "Found"; item: string; location: string; image: string; imageName: string };
  setDraft: (updates: Partial<{ status: "Lost" | "Found"; item: string; location: string; image: string; imageName: string }>) => void;
  error: string;
  selectImage: (event: ChangeEvent<HTMLInputElement>) => void;
  clearImage: () => void;
  submitLostFound: (event: FormEvent) => void;
  contactDrafts: Record<number, string>;
  updateContactDraft: (itemId: number, value: string) => void;
  activeContactId: number | null;
  setActiveContactId: (itemId: number | null) => void;
  contactLostFound: (itemId: number) => void;
  deleteLostFound: (itemId: number) => void;
  canModerate: boolean;
}) {
  return (
    <div className="viewStack">
      <form className="lostComposer" onSubmit={submitLostFound}>
        <div className="eventComposerHeader">
          <div>
            <p className="eyebrow">Lost + Found</p>
            <h2>Post an item</h2>
          </div>
          <div className="segmentedControl">
            {(["Found", "Lost"] as const).map((status) => (
              <button
                className={draft.status === status ? "active" : ""}
                key={status}
                type="button"
                onClick={() => setDraft({ status })}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
        <div className="lostFormGrid">
          <input
            value={draft.item}
            onChange={(event) => setDraft({ item: event.target.value })}
            placeholder="Item"
          />
          <input
            value={draft.location}
            onChange={(event) => setDraft({ location: event.target.value })}
            placeholder="Where?"
          />
          <MediaFilePicker
            id="lost-found-photo-file"
            label="Add photo"
            accept="image/*"
            fileName={draft.imageName}
            icon="image"
            onChange={selectImage}
            onClear={clearImage}
          />
          <button className="primaryButton" type="submit">
            <Plus size={16} />
            Post item
          </button>
        </div>
        {error ? <p className="composerError">{error}</p> : null}
      </form>

      <section className="lostGrid">
        {items.map((item) => (
          <LostFoundCard
            key={item.id}
            item={item}
            currentStudent={currentStudent}
            contactDraft={contactDrafts[item.id] ?? ""}
            updateContactDraft={(value) => updateContactDraft(item.id, value)}
            contactOpen={activeContactId === item.id}
            setContactOpen={(open) => setActiveContactId(open ? item.id : null)}
            contactLostFound={() => contactLostFound(item.id)}
            deleteLostFound={() => deleteLostFound(item.id)}
            canDelete={canModerate || item.author.handle === currentStudent.handle}
          />
        ))}
      </section>
    </div>
  );
}

function LostFoundCard({
  item,
  currentStudent,
  contactDraft,
  updateContactDraft,
  contactOpen,
  setContactOpen,
  contactLostFound,
  deleteLostFound,
  canDelete,
}: {
  item: LostFound;
  currentStudent: Student;
  contactDraft: string;
  updateContactDraft: (value: string) => void;
  contactOpen: boolean;
  setContactOpen: (open: boolean) => void;
  contactLostFound: () => void;
  deleteLostFound: () => void;
  canDelete: boolean;
}) {
  const isOwnItem = item.author.handle === currentStudent.handle;

  return (
    <article className="lostCard">
      {item.image ? <img src={item.image} alt={item.item} /> : <div className="emptyImage">{item.item}</div>}
      <div className="lostContent">
        <span className={item.status === "Found" ? "status found" : "status lost"}>{item.status}</span>
        <h2>{item.item}</h2>
        <p>{item.location}</p>
        <small>@{item.author.handle}</small>
        {contactOpen ? (
          <form
            className="lostContactForm"
            onSubmit={(event) => {
              event.preventDefault();
              contactLostFound();
            }}
          >
            <input
              value={contactDraft}
              onChange={(event) => updateContactDraft(event.target.value)}
              placeholder={`Message ${item.contact}`}
            />
            <button className="primaryButton" type="submit">
              <Send size={15} />
              Send
            </button>
          </form>
        ) : null}
        <div className="lostActions">
          {!isOwnItem ? (
            <button className="ghostButton" type="button" onClick={() => setContactOpen(!contactOpen)}>
              Contact {item.contact}
            </button>
          ) : null}
          {canDelete ? (
            <button className="iconButton dangerIcon" type="button" title="Delete item" onClick={deleteLostFound}>
              <Trash2 size={17} />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ModerationView({
  reports,
  resolveReport,
  currentStudent,
  knownStudents,
  canModerate,
  deleteAccount,
}: {
  reports: Report[];
  resolveReport: (id: number) => void;
  currentStudent: Student;
  knownStudents: Student[];
  canModerate: boolean;
  deleteAccount: (targetHandle: string) => void;
}) {
  return (
    <div className="viewStack">
      <section className="safetyIntro">
        <ShieldCheck size={28} />
        <div>
          <p className="eyebrow">Built in from day zero</p>
          <h2>Reports, consent, and campus safety queue</h2>
        </div>
      </section>

      <section className="reportList">
        {reports.map((report) => (
          <article className="reportCard" key={report.id}>
            <div>
              <span className={`severity ${report.severity.toLowerCase()}`}>{report.severity}</span>
              <h2>{report.target}</h2>
              <p>{report.reason}</p>
            </div>
            <div className="reportActions">
              <span>{report.status}</span>
              {report.status !== "Resolved" ? (
                <button className="ghostButton" onClick={() => resolveReport(report.id)}>
                  Resolve
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      {canModerate ? (
        <section className="reportList">
          <div className="safetyIntro founderPanel">
            <ShieldCheck size={24} />
            <div>
              <p className="eyebrow">Founder account</p>
              <h2>User control</h2>
            </div>
          </div>
          {knownStudents
            .filter((student) => student.handle !== currentStudent.handle)
            .slice(0, 12)
            .map((student) => (
              <article className="reportCard" key={student.handle}>
                <div className="communityMember">
                  <Avatar initials={student.avatar} image={student.photo} />
                  <span>
                    <strong>{student.name}</strong>
                    <small>@{student.handle}</small>
                  </span>
                </div>
                <div className="reportActions">
                  <button className="ghostButton dangerButton" type="button" onClick={() => deleteAccount(student.handle)}>
                    Delete account
                  </button>
                </div>
              </article>
            ))}
        </section>
      ) : null}
    </div>
  );
}

function ProfileView({
  profile,
  saveProfile,
  logout,
  yepsCount,
  joinedCommunities,
  dropsCount,
  eventStats,
  eventPostingStatus,
  uploadProfilePhoto,
  followersCount,
  followingCount,
  deleteAccount,
  canModerate,
}: {
  profile: ProfileData;
  saveProfile: (profile: ProfileData) => void;
  logout: () => void;
  yepsCount: number;
  joinedCommunities: number;
  dropsCount: number;
  eventStats: EventAuthorStats;
  eventPostingStatus: EventPostingStatus;
  uploadProfilePhoto: (file: File) => Promise<string>;
  followersCount: number;
  followingCount: number;
  deleteAccount: () => void;
  canModerate: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileData>(profile);
  const [photoUploadError, setPhotoUploadError] = useState("");
  const activeTheme = profileThemes[profile.theme];
  const draftTheme = profileThemes[draft.theme];
  const interestsText = draft.interests.join(", ");

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  const updateDraft = (updates: Partial<ProfileData>) => {
    setDraft((current) => ({ ...current, ...updates }));
  };

  const submitProfile = (event: FormEvent) => {
    event.preventDefault();
    saveProfile(draft);
    setDraft(normalizeProfile(draft));
    setEditing(false);
  };

  const cancelEditing = () => {
    setDraft(profile);
    setPhotoUploadError("");
    setEditing(false);
  };

  const selectProfilePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    try {
      setPhotoUploadError("Compressing photo...");
      const url = await uploadProfilePhoto(file);
      updateDraft({ photo: url });
      setPhotoUploadError("");
    } catch (error) {
      setPhotoUploadError(error instanceof Error ? error.message : "Could not upload this profile photo.");
    }
  };

  return (
    <section
      className="profilePanel upgradedProfile"
      style={
        {
          "--profile-accent": activeTheme.color,
          "--profile-soft": activeTheme.soft,
        } as CSSProperties
      }
    >
      <div className="profileCover">
        <div className="profileCoverPattern" />
        <div className="profileIdentity">
          <div className="profileAvatarWrap">
            <Avatar initials={profile.avatar} color={activeTheme.color} image={profile.photo} />
            <span title="Profile image slot">
              <Camera size={17} />
            </span>
          </div>
          <div>
            <p className="eyebrow">Verified student</p>
            <h2>{profile.name}</h2>
            <div className="profileHandle">
              <AtSign size={15} />
              {profile.handle}
            </div>
          </div>
          <button className="primaryButton profileEditButton" type="button" onClick={() => setEditing(true)}>
            <Pencil size={17} />
            Edit profile
          </button>
        </div>
      </div>

      <div className="profileBioBlock">
        <p>{profile.bio}</p>
        <div className="profileVibe">
          <Sparkles size={17} />
          <span>{profile.vibe}</span>
        </div>
      </div>

      <div className="profileMetaGrid">
        <span>
          <GraduationCap size={18} />
          {profile.course}
        </span>
        <span>
          <BadgeCheck size={18} />
          {profile.semester}
        </span>
        <span>
          <MapPin size={18} />
          {profile.campus}
        </span>
        <span>
          <Landmark size={18} />
          {profile.favoriteSpot}
        </span>
      </div>

      <div className="profileStats">
        <span>
          <strong>{yepsCount}</strong>
          Yeps
        </span>
        <span>
          <strong>{joinedCommunities}</strong>
          Communities
        </span>
        <span>
          <strong>{dropsCount}</strong>
          Drops
        </span>
        <span>
          <strong>{followersCount}</strong>
          Followers
        </span>
        <span>
          <strong>{followingCount}</strong>
          Following
        </span>
        <span>
          <strong>{eventStats.posted}</strong>
          Events posted
        </span>
        <span>
          <strong>{eventStats.real}</strong>
          Real events
        </span>
        <span>
          <strong>{eventStats.fake}</strong>
          Fake events
        </span>
      </div>

      {eventPostingStatus.isBlocked ? (
        <div className="profileEventWarning">
          <CircleAlert size={18} />
          Event posting paused until {formatBlockDate(eventPostingStatus.blockedUntil)}
        </div>
      ) : null}

      <div className="profileInterestRack" aria-label="Profile interests">
        {profile.interests.map((interest) => (
          <span key={interest}>#{interest}</span>
        ))}
      </div>

      <section className="profileWallPreview" aria-label="Profile wall preview">
        <div>
          <p className="eyebrow">Pinned wall</p>
          <h3>{profile.vibe}</h3>
          <p>{profile.favoriteSpot} is where the campus signal gets loud.</p>
        </div>
        <div className="wallTape">Yep verified</div>
      </section>

      {editing ? (
        <form
          className="profileEditor"
          onSubmit={submitProfile}
          style={
            {
              "--profile-accent": draftTheme.color,
              "--profile-soft": draftTheme.soft,
            } as CSSProperties
          }
        >
          <div className="editorHeader">
            <div>
              <p className="eyebrow">Profile editor</p>
              <h3>Make it feel like you</h3>
            </div>
            <button className="iconButton" type="button" title="Close editor" onClick={cancelEditing}>
              <X size={18} />
            </button>
          </div>

          <div className="profileFormGrid">
            <label>
              Display name
              <input value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} />
            </label>
            <label>
              Handle
              <input value={draft.handle} onChange={(event) => updateDraft({ handle: event.target.value })} />
            </label>
            <label>
              Avatar initials
              <input value={draft.avatar} onChange={(event) => updateDraft({ avatar: event.target.value })} />
            </label>
            <label>
              Vibe
              <input value={draft.vibe} onChange={(event) => updateDraft({ vibe: event.target.value })} />
            </label>
            <label>
              Course
              <input value={draft.course} onChange={(event) => updateDraft({ course: event.target.value })} />
            </label>
            <label>
              Semester
              <input value={draft.semester} onChange={(event) => updateDraft({ semester: event.target.value })} />
            </label>
            <label>
              Campus
              <input value={draft.campus} onChange={(event) => updateDraft({ campus: event.target.value })} />
            </label>
            <label>
              Favorite spot
              <input value={draft.favoriteSpot} onChange={(event) => updateDraft({ favoriteSpot: event.target.value })} />
            </label>
          </div>

          <div className="profilePhotoEditor">
            <MediaFilePicker
              id="profile-photo-file"
              label="Profile photo"
              accept="image/*"
              fileName={draft.photo ? "Photo selected" : ""}
              icon="image"
              onChange={selectProfilePhoto}
              onClear={() => updateDraft({ photo: undefined })}
            />
            {photoUploadError ? <p className="composerError">{photoUploadError}</p> : null}
          </div>

          <label className="profileWideField">
            Bio
            <textarea
              value={draft.bio}
              maxLength={160}
              rows={3}
              onChange={(event) => updateDraft({ bio: event.target.value })}
            />
            <span>{draft.bio.length}/160</span>
          </label>

          <label className="profileWideField">
            Interests
            <input
              value={interestsText}
              onChange={(event) =>
                updateDraft({
                  interests: event.target.value
                    .split(",")
                    .map((interest) => interest.trim())
                    .filter(Boolean),
                })
              }
              placeholder="IHC, AI, CampusBeat"
            />
          </label>

          <div className="profileThemePicker" aria-label="Profile theme picker">
            <div>
              <Palette size={18} />
              Profile color
            </div>
            {Object.entries(profileThemes).map(([themeKey, themeValue]) => (
              <button
                className={draft.theme === themeKey ? "active" : ""}
                key={themeKey}
                type="button"
                title={themeValue.label}
                onClick={() => updateDraft({ theme: themeKey as ProfileData["theme"] })}
              >
                <span style={{ background: themeValue.color }} />
              </button>
            ))}
          </div>

          <div className="profileEditorActions">
            <button className="primaryButton" type="submit">
              <Save size={17} />
              Save profile
            </button>
            <button className="ghostButton" type="button" onClick={cancelEditing}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <button className="ghostButton" onClick={logout}>
        Switch account
      </button>
      <button className="ghostButton dangerButton" type="button" onClick={deleteAccount}>
        Delete account
      </button>
      {canModerate ? <span className="profileFounderBadge">Founder powers active</span> : null}
    </section>
  );
}

function CampusPulse() {
  return (
    <section className="railCard pulseCard">
      <p className="eyebrow">Campus pulse</p>
      <h2>Live at Unifacs</h2>
      <div className="pulseMetric">
        <Flame size={20} />
        <span>386 posts today</span>
      </div>
      <div className="pulseMetric">
        <Landmark size={20} />
        <span>4 campuses active</span>
      </div>
      <div className="pulseMetric">
        <ShieldCheck size={20} />
        <span>2 reports in review</span>
      </div>
    </section>
  );
}

function NotificationsRail({
  notifications,
  unreadCount,
  markAllRead,
  openDirect,
}: {
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
  openDirect: (conversationId: string, type: Notification["type"]) => void;
}) {
  return (
    <section className="railCard notificationRail">
      <div className="railHeader">
        <h2>Notifications</h2>
        <Bell size={18} />
      </div>
      {notifications.length ? (
        <>
          <div className="notificationList">
            {notifications.slice(0, 5).map((notification) => (
              <button
                className={notification.read ? "notificationItem" : "notificationItem unread"}
                key={notification.id}
                type="button"
                onClick={() => {
                  if (
                    notification.targetId &&
                    (notification.type === "direct" || notification.type === "lostfound")
                  ) {
                    openDirect(notification.targetId, notification.type);
                  }
                }}
              >
                <Avatar initials={notification.actor.avatar} image={notification.actor.photo} />
                <span>{notification.message}</span>
              </button>
            ))}
          </div>
          {unreadCount ? (
            <button className="ghostButton" type="button" onClick={markAllRead}>
              Mark read
            </button>
          ) : null}
        </>
      ) : (
        <p className="railMuted">No notifications yet.</p>
      )}
    </section>
  );
}

function TrendingRail({
  trends,
  selectedTrend,
  onPick,
}: {
  trends: Trend[];
  selectedTrend: string | null;
  onPick: (tag: string) => void;
}) {
  return (
    <section className="railCard">
      <div className="railHeader">
        <h2>Trending</h2>
        <TrendingUp size={18} />
      </div>
      <div className="trendRailList">
        {trends.slice(0, 4).map((trend) => (
          <button
            className={selectedTrend === trend.tag ? "trendRailItem active" : "trendRailItem"}
            key={trend.tag}
            onClick={() => onPick(trend.tag)}
          >
            <span>{trend.tag}</span>
            <small>{trend.posts}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function MiniEvents({ events }: { events: CampusEvent[] }) {
  const nextEvents = [...events]
    .filter((event) => !isEventPast(event))
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
    .slice(0, 2);

  return (
    <section className="railCard">
      <div className="railHeader">
        <h2>Next events</h2>
        <CalendarDays size={18} />
      </div>
      {nextEvents.map((event) => (
        <div className="miniEvent" key={event.id}>
          <strong>{event.title}</strong>
          <span>{event.date}</span>
        </div>
      ))}
      {nextEvents.length === 0 ? <p className="emptyComments">No upcoming events yet.</p> : null}
    </section>
  );
}

export default App;
