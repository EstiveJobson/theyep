import { FormEvent, useMemo, useState } from "react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CircleAlert,
  Flame,
  Hash,
  Home,
  Inbox,
  Landmark,
  LockKeyhole,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Plus,
  Radio,
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
  initialDrops,
  initialPosts,
  initialReports,
  lostFound,
  me,
  studyGroups,
  trends,
} from "./data";
import type {
  CampusEvent,
  Community,
  Drop,
  LostFound,
  Post,
  ReactionKey,
  Report,
  StudyGroup,
  View,
} from "./types";

type Session = {
  email: string;
  name: string;
  campus: string;
};

type Theme = "light" | "dark";

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

function Avatar({ initials, color }: { initials: string; color?: string }) {
  return (
    <div className="avatar" style={color ? { background: color } : undefined}>
      {initials}
    </div>
  );
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
  const [activeView, setActiveView] = useState<View>("home");
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [drops, setDrops] = useState<Drop[]>(initialDrops);
  const [postBody, setPostBody] = useState("");
  const [dropBody, setDropBody] = useState("");
  const [selectedTrend, setSelectedTrend] = useState<string | null>(null);
  const [joinedCommunities, setJoinedCommunities] = useState<Set<number>>(() => new Set([1, 2]));
  const [rsvps, setRsvps] = useState<Set<number>>(() => new Set([2]));
  const [joinedGroups, setJoinedGroups] = useState<Set<number>>(() => new Set([1]));
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("Harassment or bullying");
  const [search, setSearch] = useState("");

  const visiblePosts = useMemo(() => {
    const trendFiltered = selectedTrend
      ? posts.filter((post) => post.tags.includes(selectedTrend))
      : posts;
    const query = search.trim().toLowerCase();
    if (!query) return trendFiltered;

    return trendFiltered.filter((post) => {
      const haystack = `${post.body} ${post.author.name} ${post.community} ${post.tags.join(" ")}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [posts, search, selectedTrend]);

  if (!session) {
    return <VerificationGate onVerified={setSession} />;
  }

  const createPost = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = postBody.trim();
    if (!trimmed) return;

    const tagsFromBody = trimmed.match(/#[\w]+/g) ?? ["#Campus"];
    const nextPost: Post = {
      id: Date.now(),
      author: me,
      time: "now",
      body: trimmed,
      tags: tagsFromBody,
      community: "Campus Feed",
      comments: 0,
      shares: 0,
      reactions: { yep: 0, nope: 0, loud: 0, mood: 0, iconic: 0, in: 0 },
    };
    setPosts((current) => [nextPost, ...current]);
    setPostBody("");
    setActiveView("home");
  };

  const createDrop = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = dropBody.trim();
    if (!trimmed) return;

    const nextDrop: Drop = {
      id: Date.now(),
      author: me,
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
            selectedTrend={selectedTrend}
            postBody={postBody}
            setPostBody={setPostBody}
            createPost={createPost}
            reactToPost={reactToPost}
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
          <ProfileView session={session} logout={logout} joinedCommunities={joinedCommunities.size} />
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
  selectedTrend,
  postBody,
  setPostBody,
  createPost,
  reactToPost,
  openReport,
  clearTrend,
}: {
  drops: Drop[];
  posts: Post[];
  selectedTrend: string | null;
  postBody: string;
  setPostBody: (value: string) => void;
  createPost: (event: FormEvent) => void;
  reactToPost: (postId: number, key: ReactionKey) => void;
  openReport: (target: string) => void;
  clearTrend: () => void;
}) {
  return (
    <div className="viewStack">
      <DropStrip drops={drops} />

      <form className="composer" onSubmit={createPost}>
        <Avatar initials={me.avatar} />
        <div className="composerBody">
          <textarea
            value={postBody}
            onChange={(event) => setPostBody(event.target.value)}
            placeholder="What should campus know?"
            rows={3}
          />
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
          <PostCard key={post.id} post={post} reactToPost={reactToPost} openReport={openReport} />
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
  reactToPost,
  openReport,
}: {
  post: Post;
  reactToPost: (postId: number, key: ReactionKey) => void;
  openReport: (target: string) => void;
}) {
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
        <button className="iconButton subtle" title="More options" onClick={() => openReport(`Post by @${post.author.handle}`)}>
          <MoreHorizontal size={18} />
        </button>
      </header>
      <p className="postBody">{post.body}</p>
      {post.image ? <img className="postImage" src={post.image} alt="" /> : null}
      <div className="tagRow">
        {post.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <footer className="postFooter">
        <div className="reactionBar">
          {reactionMeta.map((reaction) => (
            <button
              key={reaction.key}
              title={reaction.label}
              aria-label={`${reaction.label}: ${post.reactions[reaction.key]}`}
              onClick={() => reactToPost(post.id, reaction.key)}
            >
              <reaction.icon size={15} />
              <span>{post.reactions[reaction.key]}</span>
            </button>
          ))}
        </div>
        <div className="postStats">
          <span>
            <MessageCircle size={15} />
            {post.comments}
          </span>
          <span>{post.community}</span>
        </div>
      </footer>
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
  session,
  logout,
  joinedCommunities,
}: {
  session: Session;
  logout: () => void;
  joinedCommunities: number;
}) {
  return (
    <section className="profilePanel">
      <div className="profileHero">
        <Avatar initials={me.avatar} />
        <div>
          <p className="eyebrow">Verified student</p>
          <h2>{session.name}</h2>
          <span>@{me.handle} · {me.course} · {me.semester}</span>
        </div>
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
      <div className="themeStrip" aria-label="Profile theme colors">
        <span style={{ background: "#ff2d75" }} />
        <span style={{ background: "#00b8d9" }} />
        <span style={{ background: "#ffe94d" }} />
        <span style={{ background: "#8bd346" }} />
      </div>
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
