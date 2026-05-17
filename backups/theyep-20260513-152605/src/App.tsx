import { type CSSProperties, FormEvent, type ReactNode, useMemo, useState } from "react";
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
  TrendingUp,
  UserRound,
  UsersRound,
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
  studyGroups,
  trends,
} from "./data";
import type {
  CampusEvent,
  Community,
  Drop,
  LostFound,
  Post,
  PostComment,
  ReactionKey,
  Report,
  StudyGroup,
  Student,
  View,
} from "./types";

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

const profileThemes: Record<ProfileData["theme"], { label: string; color: string; soft: string }> = {
  pink: { label: "Pop pink", color: "#ff2d75", soft: "#fff4f8" },
  cyan: { label: "Electric cyan", color: "#00b8d9", soft: "#e9fbff" },
  yellow: { label: "Yep yellow", color: "#ffe94d", soft: "#fffbe0" },
  lime: { label: "Campus lime", color: "#8bd346", soft: "#f1ffe8" },
};

const navItems: Array<{
  id: View;
  label: string;
  icon: typeof Home;
}> = [
  { id: "home", label: "Feed", icon: Home },
  { id: "drops", label: "Drops", icon: TimerReset },
  { id: "trends", label: "Trends", icon: TrendingUp },
  { id: "communities", label: "Communities", icon: UsersRound },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "study", label: "Study", icon: BookOpen },
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
  };
}

function Avatar({ initials, color }: { initials: string; color?: string }) {
  return (
    <div className="avatar" style={color ? { background: color } : undefined}>
      {initials}
    </div>
  );
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

function colorizePostText(text: string): ReactNode[] {
  const tokens = text.split(/(\s+)/);
  const wordEntries = tokens
    .map((token, index) => {
      const word = token.match(/[\p{L}\p{N}]+/gu)?.join("") ?? "";
      return { index, token, word };
    })
    .filter(({ word }) => word.length > 0);
  const candidates = wordEntries.filter(({ word }) => word.length >= 3);
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

function VerificationGate({ onVerified }: { onVerified: (session: Session) => void }) {
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
    const session = {
      email: "sergio@estudante.unifacs.br",
      name: "Sergio Matos",
      campus: "Unifacs Salvador",
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
            Student-only feed, 24h drops, campus trends, communities, events, study groups,
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
  const [postMoodError, setPostMoodError] = useState("");
  const [dropBody, setDropBody] = useState("");
  const [selectedTrend, setSelectedTrend] = useState<string | null>(null);
  const [joinedCommunities, setJoinedCommunities] = useState<Set<number>>(() => new Set([1, 2]));
  const [rsvps, setRsvps] = useState<Set<number>>(() => new Set([2]));
  const [joinedGroups, setJoinedGroups] = useState<Set<number>>(() => new Set([1]));
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("Harassment or bullying");
  const [search, setSearch] = useState("");
  const currentStudent = useMemo(() => profileToStudent(profile), [profile]);

  const visiblePosts = useMemo(() => {
    const trendFiltered = selectedTrend
      ? posts.filter((post) => post.tags.includes(selectedTrend))
      : posts;
    const query = search.trim().toLowerCase();
    if (!query) return trendFiltered;

    return trendFiltered.filter((post) => {
      const commentText = flattenCommentText(commentsByPost[post.id] ?? []);
      const haystack = `${post.body} ${post.mood} ${post.author.name} ${post.community} ${post.tags.join(" ")} ${commentText}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [commentsByPost, posts, search, selectedTrend]);

  if (!session) {
    return <VerificationGate onVerified={setSession} />;
  }

  const createPost = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = postBody.trim();
    if (!trimmed) return;
    const moodValidation = validateMood(postMood);
    if (!moodValidation.ok) {
      setPostMoodError(moodValidation.error);
      return;
    }

    const tagsFromBody = trimmed.match(/#[\w]+/g) ?? ["#Campus"];
    const nextPost: Post = {
      id: Date.now(),
      author: currentStudent,
      time: "now",
      body: trimmed,
      mood: moodValidation.mood,
      tags: tagsFromBody,
      community: "Campus Feed",
      comments: 0,
      shares: 0,
      reactions: { yep: 0, nope: 0, loud: 0, mood: 0, iconic: 0, in: 0 },
    };
    setPosts((current) => [nextPost, ...current]);
    setPostBody("");
    setPostMood("");
    setPostMoodError("");
    setActiveView("home");
  };

  const createDrop = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = dropBody.trim();
    if (!trimmed) return;

    const nextDrop: Drop = {
      id: Date.now(),
      author: currentStudent,
      kind: "text",
      body: trimmed,
      expiresIn: "24h",
      viewers: 0,
      tags: trimmed.match(/#[\w]+/g) ?? ["#Live"],
    };
    setDrops((current) => [nextDrop, ...current]);
    setDropBody("");
    setActiveView("drops");
  };

  const reactToPost = (postId: number, key: ReactionKey) => {
    const reactionsForPost = userReactions[postId] ?? [];
    const hasReacted = reactionsForPost.includes(key);

    if (hasReacted) {
      setUserReactions((current) => ({
        ...current,
        [postId]: (current[postId] ?? []).filter((reaction) => reaction !== key),
      }));
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                reactions: {
                  ...post.reactions,
                  [key]: Math.max(0, post.reactions[key] - 1),
                },
              }
            : post,
        ),
      );
      return;
    }

    if (reactionsForPost.length >= 3) return;

    setUserReactions((current) => ({
      ...current,
      [postId]: [...(current[postId] ?? []), key],
    }));
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              reactions: {
                ...post.reactions,
                [key]: post.reactions[key] + 1,
              },
            }
          : post,
      ),
    );
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

  const submitComment = (event: FormEvent, postId: number) => {
    event.preventDefault();
    const body = (commentDrafts[postId] ?? "").trim();
    if (!body) return;

    const comment: PostComment = {
      id: `comment-${postId}-${Date.now()}`,
      author: currentStudent,
      time: "now",
      body,
      replies: [],
    };

    setCommentsByPost((current) => ({
      ...current,
      [postId]: [comment, ...(current[postId] ?? [])],
    }));
    updateCommentDraft(postId, "");
    setOpenComments((current) => new Set(current).add(postId));
  };

  const updateReplyDraft = (commentId: string, value: string) => {
    setReplyDrafts((current) => ({
      ...current,
      [commentId]: value,
    }));
  };

  const submitReply = (event: FormEvent, postId: number, parentId: string) => {
    event.preventDefault();
    const body = (replyDrafts[parentId] ?? "").trim();
    if (!body) return;
    const parentTarget = findCommentTarget(commentsByPost[postId] ?? [], parentId);
    if (!parentTarget) return;

    const reply: PostComment = {
      id: `reply-${parentId}-${Date.now()}`,
      author: currentStudent,
      time: "now",
      body,
      replyTo:
        parentTarget.depth > 0
          ? {
              id: parentTarget.comment.id,
              name: parentTarget.comment.author.name,
              handle: parentTarget.comment.author.handle,
            }
          : undefined,
      replies: [],
    };

    setCommentsByPost((current) => ({
      ...current,
      [postId]: addReplyToComment(current[postId] ?? [], parentTarget.rootId, reply),
    }));
    updateReplyDraft(parentId, "");
    setActiveReplyId(null);
    setCollapsedReplies((current) => {
      const next = new Set(current);
      next.delete(parentTarget.rootId);
      return next;
    });
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

  const submitReport = (event: FormEvent) => {
    event.preventDefault();
    if (!reportTarget) return;
    const nextReport: Report = {
      id: Date.now(),
      target: reportTarget,
      reason: reportReason,
      severity: reportReason.includes("Threat") ? "High" : "Medium",
      status: "Open",
    };
    setReports((current) => [nextReport, ...current]);
    setReportTarget(null);
    setActiveView("moderation");
  };

  const resolveReport = (reportId: number) => {
    setReports((current) =>
      current.map((report) =>
        report.id === reportId ? { ...report, status: "Resolved" } : report,
      ),
    );
  };

  const saveProfile = (nextProfile: ProfileData) => {
    const normalized = normalizeProfile(nextProfile);
    setProfile(normalized);
    localStorage.setItem("theyep-profile", JSON.stringify(normalized));
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

  return (
    <div className="appShell" data-theme={theme}>
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
            userReactions={userReactions}
            commentsByPost={commentsByPost}
            openComments={openComments}
            commentDrafts={commentDrafts}
            replyDrafts={replyDrafts}
            activeReplyId={activeReplyId}
            collapsedReplies={collapsedReplies}
            selectedTrend={selectedTrend}
            postBody={postBody}
            setPostBody={setPostBody}
            postMood={postMood}
            setPostMood={(value) => {
              setPostMood(value);
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
            setActiveReplyId={setActiveReplyId}
            toggleReplies={toggleReplies}
            openReport={setReportTarget}
            clearTrend={() => setSelectedTrend(null)}
          />
        ) : null}

        {activeView === "drops" ? (
          <DropsView
            drops={drops}
            dropBody={dropBody}
            setDropBody={setDropBody}
            createDrop={createDrop}
            openReport={setReportTarget}
          />
        ) : null}

        {activeView === "trends" ? (
          <TrendsView setSelectedTrend={setSelectedTrend} setActiveView={setActiveView} />
        ) : null}

        {activeView === "communities" ? (
          <CommunitiesView
            joinedCommunities={joinedCommunities}
            toggleCommunity={(id) => toggleSet(setJoinedCommunities, id)}
          />
        ) : null}

        {activeView === "events" ? (
          <EventsView rsvps={rsvps} toggleRsvp={(id) => toggleSet(setRsvps, id)} />
        ) : null}

        {activeView === "study" ? (
          <StudyView joinedGroups={joinedGroups} toggleGroup={(id) => toggleSet(setJoinedGroups, id)} />
        ) : null}

        {activeView === "lost" ? <LostFoundView /> : null}

        {activeView === "moderation" ? (
          <ModerationView reports={reports} resolveReport={resolveReport} />
        ) : null}

        {activeView === "profile" ? (
          <ProfileView
            profile={profile}
            saveProfile={saveProfile}
            logout={logout}
            joinedCommunities={joinedCommunities.size}
          />
        ) : null}
      </main>

      <aside className="rightRail">
        <CampusPulse />
        <TrendingRail
          selectedTrend={selectedTrend}
          onPick={(tag) => {
            setSelectedTrend(tag);
            setActiveView("home");
          }}
        />
        <MiniEvents />
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
    communities: "Communities",
    events: "Events",
    study: "Study Groups",
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
  userReactions,
  commentsByPost,
  openComments,
  commentDrafts,
  replyDrafts,
  activeReplyId,
  collapsedReplies,
  selectedTrend,
  postBody,
  setPostBody,
  postMood,
  setPostMood,
  postMoodError,
  createPost,
  reactToPost,
  toggleComments,
  updateCommentDraft,
  submitComment,
  updateReplyDraft,
  submitReply,
  setActiveReplyId,
  toggleReplies,
  openReport,
  clearTrend,
}: {
  drops: Drop[];
  posts: Post[];
  currentStudent: Student;
  userReactions: Record<number, ReactionKey[]>;
  commentsByPost: Record<number, PostComment[]>;
  openComments: Set<number>;
  commentDrafts: Record<number, string>;
  replyDrafts: Record<string, string>;
  activeReplyId: string | null;
  collapsedReplies: Set<string>;
  selectedTrend: string | null;
  postBody: string;
  setPostBody: (value: string) => void;
  postMood: string;
  setPostMood: (value: string) => void;
  postMoodError: string;
  createPost: (event: FormEvent) => void;
  reactToPost: (postId: number, key: ReactionKey) => void;
  toggleComments: (postId: number) => void;
  updateCommentDraft: (postId: number, value: string) => void;
  submitComment: (event: FormEvent, postId: number) => void;
  updateReplyDraft: (commentId: string, value: string) => void;
  submitReply: (event: FormEvent, postId: number, parentId: string) => void;
  setActiveReplyId: (commentId: string | null) => void;
  toggleReplies: (commentId: string) => void;
  openReport: (target: string) => void;
  clearTrend: () => void;
}) {
  return (
    <div className="viewStack">
      <DropStrip drops={drops} />

      <form className="composer" onSubmit={createPost}>
        <Avatar initials={currentStudent.avatar} />
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
            setActiveReplyId={setActiveReplyId}
            toggleReplies={toggleReplies}
            openReport={openReport}
          />
        ))}
      </section>
    </div>
  );
}

function DropStrip({ drops }: { drops: Drop[] }) {
  return (
    <section className="dropStrip" aria-label="Live drops">
      {drops.slice(0, 6).map((drop) => (
        <article className="dropBubble" key={drop.id}>
          <div className="dropMedia">
            {drop.image ? <img src={drop.image} alt={drop.body} /> : <span>{drop.body.slice(0, 28)}</span>}
          </div>
          <strong>{drop.author.avatar}</strong>
          <span>{drop.expiresIn}</span>
        </article>
      ))}
    </section>
  );
}

function PostCard({
  post,
  currentStudent,
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
  setActiveReplyId,
  toggleReplies,
  openReport,
}: {
  post: Post;
  currentStudent: Student;
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
  setActiveReplyId: (commentId: string | null) => void;
  toggleReplies: (commentId: string) => void;
  openReport: (target: string) => void;
}) {
  const reactionLimit = 3;
  const reactedSet = new Set(userReactions);
  const hasReachedReactionLimit = userReactions.length >= reactionLimit;
  const commentCount = countComments(comments);

  return (
    <article className="postCard">
      <header className="postHeader">
        <Avatar initials={post.author.avatar} />
        <div>
          <strong>{post.author.name}</strong>
          <span>
            @{post.author.handle} · {post.author.course} · {post.time}
          </span>
        </div>
        <span className="postMood">{post.mood}</span>
        <button className="iconButton subtle" title="More options" onClick={() => openReport(`Post by @${post.author.handle}`)}>
          <MoreHorizontal size={18} />
        </button>
      </header>
      <p className="postBody">{colorizePostText(post.body)}</p>
      {post.image ? <img className="postImage" src={post.image} alt="" /> : null}
      <div className="tagRow">
        {post.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
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
            setActiveReplyId={setActiveReplyId}
            toggleReplies={toggleReplies}
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
  setActiveReplyId,
  toggleReplies,
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
  setActiveReplyId: (commentId: string | null) => void;
  toggleReplies: (commentId: string) => void;
}) {
  return (
    <section className="commentPanel" aria-label="Post comments">
      <div className="commentPanelHeader">
        <strong>Campus replies</strong>
        <span>Newest first</span>
      </div>

      <form className="commentComposer" onSubmit={(event) => submitComment(event, postId)}>
        <Avatar initials={currentStudent.avatar} />
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
              replyDrafts={replyDrafts}
              setActiveReplyId={setActiveReplyId}
              submitReply={submitReply}
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
  depth,
  replyDrafts,
  activeReplyId,
  collapsedReplies,
  updateReplyDraft,
  submitReply,
  setActiveReplyId,
  toggleReplies,
}: {
  comment: PostComment;
  postId: number;
  depth: number;
  replyDrafts: Record<string, string>;
  activeReplyId: string | null;
  collapsedReplies: Set<string>;
  updateReplyDraft: (commentId: string, value: string) => void;
  submitReply: (event: FormEvent, postId: number, parentId: string) => void;
  setActiveReplyId: (commentId: string | null) => void;
  toggleReplies: (commentId: string) => void;
}) {
  const replyOpen = activeReplyId === comment.id;
  const hasReplies = comment.replies.length > 0;
  const repliesHidden = collapsedReplies.has(comment.id);

  return (
    <article className={depth > 0 ? "commentItem nested" : "commentItem"} id={`comment-node-${comment.id}`}>
      <Avatar initials={comment.author.avatar} />
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
                depth={1}
                key={reply.id}
                postId={postId}
                replyDrafts={replyDrafts}
                setActiveReplyId={setActiveReplyId}
                submitReply={submitReply}
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
  createDrop,
  openReport,
}: {
  drops: Drop[];
  dropBody: string;
  setDropBody: (value: string) => void;
  createDrop: (event: FormEvent) => void;
  openReport: (target: string) => void;
}) {
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
        <button className="primaryButton" type="submit">
          <Plus size={17} />
          Add drop
        </button>
      </form>
      <section className="dropGrid">
        {drops.map((drop) => (
          <article className={drop.image ? "dropCard withImage" : "dropCard"} key={drop.id}>
            {drop.image ? <img src={drop.image} alt={drop.body} /> : null}
            <div className="dropCardContent">
              <div className="dropCardTop">
                <Avatar initials={drop.author.avatar} />
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

function TrendsView({
  setSelectedTrend,
  setActiveView,
}: {
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

function CommunitiesView({
  joinedCommunities,
  toggleCommunity,
}: {
  joinedCommunities: Set<number>;
  toggleCommunity: (id: number) => void;
}) {
  return (
    <section className="communityGrid">
      {communities.map((community) => (
        <CommunityCard
          key={community.id}
          community={community}
          joined={joinedCommunities.has(community.id)}
          toggleCommunity={toggleCommunity}
        />
      ))}
    </section>
  );
}

function CommunityCard({
  community,
  joined,
  toggleCommunity,
}: {
  community: Community;
  joined: boolean;
  toggleCommunity: (id: number) => void;
}) {
  return (
    <article className="communityCard" style={{ borderTopColor: community.accent }}>
      <div className="communityHeader">
        <div>
          <p className="eyebrow">{community.category}</p>
          <h2>{community.name}</h2>
        </div>
        <button className={joined ? "joinedButton" : "ghostButton"} onClick={() => toggleCommunity(community.id)}>
          {joined ? "Joined" : "Join"}
        </button>
      </div>
      <p>{community.description}</p>
      <div className="communityMeta">
        <span>{community.members} members</span>
        <span>Top: {community.topPost}</span>
      </div>
    </article>
  );
}

function EventsView({ rsvps, toggleRsvp }: { rsvps: Set<number>; toggleRsvp: (id: number) => void }) {
  return (
    <section className="eventList">
      {events.map((event) => (
        <EventCard key={event.id} event={event} isGoing={rsvps.has(event.id)} toggleRsvp={toggleRsvp} />
      ))}
    </section>
  );
}

function EventCard({
  event,
  isGoing,
  toggleRsvp,
}: {
  event: CampusEvent;
  isGoing: boolean;
  toggleRsvp: (id: number) => void;
}) {
  return (
    <article className="eventCard">
      <div className="eventDate">
        <CalendarDays size={20} />
        <span>{event.date}</span>
      </div>
      <div>
        <p className="eyebrow">{event.category}</p>
        <h2>{event.title}</h2>
        <span>{event.location}</span>
      </div>
      <div className="eventActions">
        <span>{event.attendees + (isGoing ? 1 : 0)} going</span>
        <button className={isGoing ? "joinedButton" : "ghostButton"} onClick={() => toggleRsvp(event.id)}>
          {isGoing ? "Going" : "RSVP"}
        </button>
      </div>
    </article>
  );
}

function StudyView({
  joinedGroups,
  toggleGroup,
}: {
  joinedGroups: Set<number>;
  toggleGroup: (id: number) => void;
}) {
  return (
    <section className="studyGrid">
      {studyGroups.map((group) => (
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

function LostFoundView() {
  return (
    <section className="lostGrid">
      {lostFound.map((item) => (
        <LostFoundCard key={item.id} item={item} />
      ))}
    </section>
  );
}

function LostFoundCard({ item }: { item: LostFound }) {
  return (
    <article className="lostCard">
      {item.image ? <img src={item.image} alt={item.item} /> : <div className="emptyImage">{item.item}</div>}
      <div className="lostContent">
        <span className={item.status === "Found" ? "status found" : "status lost"}>{item.status}</span>
        <h2>{item.item}</h2>
        <p>{item.location}</p>
        <button className="ghostButton">Contact {item.contact}</button>
      </div>
    </article>
  );
}

function ModerationView({
  reports,
  resolveReport,
}: {
  reports: Report[];
  resolveReport: (id: number) => void;
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
    </div>
  );
}

function ProfileView({
  profile,
  saveProfile,
  logout,
  joinedCommunities,
}: {
  profile: ProfileData;
  saveProfile: (profile: ProfileData) => void;
  logout: () => void;
  joinedCommunities: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileData>(profile);
  const activeTheme = profileThemes[profile.theme];
  const draftTheme = profileThemes[draft.theme];
  const interestsText = draft.interests.join(", ");

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
    setEditing(false);
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
            <Avatar initials={profile.avatar} color={activeTheme.color} />
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
          <strong>142</strong>
          Yeps
        </span>
        <span>
          <strong>{joinedCommunities}</strong>
          Communities
        </span>
        <span>
          <strong>8</strong>
          Drops
        </span>
      </div>

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

function TrendingRail({
  selectedTrend,
  onPick,
}: {
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

function MiniEvents() {
  return (
    <section className="railCard">
      <div className="railHeader">
        <h2>Next events</h2>
        <CalendarDays size={18} />
      </div>
      {events.slice(0, 2).map((event) => (
        <div className="miniEvent" key={event.id}>
          <strong>{event.title}</strong>
          <span>{event.date}</span>
        </div>
      ))}
    </section>
  );
}

export default App;
