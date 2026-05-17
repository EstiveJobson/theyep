export type View =
  | "home"
  | "drops"
  | "trends"
  | "direct"
  | "videos"
  | "communities"
  | "events"
  | "lost"
  | "moderation"
  | "profile";

export type ReactionKey = "yep" | "nope" | "loud" | "mood" | "iconic" | "in";

export type PostVisibility = "main" | "community" | "both";
export type Language = "pt-BR" | "en";
export type CampusName = "Campus Paralela" | "Campus Tancredo Neves";
export type ContentAudience = "general" | "campus";

export type Student = {
  name: string;
  handle: string;
  course: string;
  semester: string;
  campus: CampusName | string;
  avatar: string;
  photo?: string;
};

export type Post = {
  id: number;
  author: Student;
  time: string;
  createdAt?: string;
  body: string;
  mood: string;
  image?: string;
  video?: string;
  campus?: CampusName | string;
  audience?: ContentAudience;
  tags: string[];
  community: string;
  communityId?: number;
  visibility?: PostVisibility;
  reactions: Record<ReactionKey, number>;
  comments: number;
  shares: number;
};

export type PostComment = {
  id: string;
  author: Student;
  time: string;
  body: string;
  replyTo?: {
    id: string;
    name: string;
    handle: string;
  };
  replies: PostComment[];
};

export type Drop = {
  id: number;
  author: Student;
  kind: "photo" | "text";
  body: string;
  image?: string;
  campus?: CampusName | string;
  audience?: ContentAudience;
  expiresIn: string;
  viewers: number;
  tags: string[];
};

export type DirectMessage = {
  id: string;
  author: Student;
  body: string;
  image?: string;
  createdAt: string;
  time: string;
};

export type DirectMessageWindow = {
  total: number;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  beforeCursor?: string;
  afterCursor?: string;
};

export type DirectConversation = {
  id: string;
  title?: string;
  isGroup?: boolean;
  avatar?: string;
  kind?: "social" | "lostfound";
  participants: Student[];
  updatedAt: string;
  unreadBy: string[];
  messages: DirectMessage[];
  lastMessage?: DirectMessage;
  messageWindow?: DirectMessageWindow;
};

export type Trend = {
  tag: string;
  posts: number;
  scope: string;
  heat: number;
};

export type Community = {
  id: number;
  name: string;
  category: string;
  members: number;
  accent: string;
  avatar?: string;
  campus?: CampusName | string;
  description: string;
  topPost: string;
  creator: Student;
  createdAt: string;
};

export type CampusEvent = {
  id: number;
  title: string;
  date: string;
  startsAt: string;
  createdAt: string;
  location: string;
  campus?: CampusName | string;
  category: string;
  author: Student;
  attendees: number;
  editCount: number;
  trueVotes: number;
  falseVotes: number;
};

export type StudyGroup = {
  id: number;
  subject: string;
  host: Student;
  time: string;
  place: string;
  seats: number;
};

export type LostFound = {
  id: number;
  status: "Lost" | "Found";
  item: string;
  location: string;
  contact: string;
  author: Student;
  campus?: CampusName | string;
  createdAt: string;
  image?: string;
};

export type Report = {
  id: number;
  target: string;
  reason: string;
  severity: "Low" | "Medium" | "High";
  status: "Open" | "Reviewing" | "Resolved";
};

export type Notification = {
  id: string;
  recipientHandle: string;
  actor: Student;
  type: "reaction" | "follow" | "direct" | "lostfound" | "system";
  message: string;
  targetId?: string;
  createdAt: string;
  read: boolean;
};

export type UserAccount = {
  email: string;
  handle: string;
  passwordHash: string;
  passwordSalt: string;
  profile: Student;
  language: Language;
  createdAt: string;
};

export type VerificationCode = {
  email: string;
  code: string;
  expiresAt: string;
  attempts: number;
};
