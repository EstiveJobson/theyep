export type View =
  | "home"
  | "drops"
  | "trends"
  | "communities"
  | "events"
  | "study"
  | "lost"
  | "moderation"
  | "profile";

export type ReactionKey = "yep" | "nope" | "loud" | "mood" | "iconic" | "in";

export type Student = {
  name: string;
  handle: string;
  course: string;
  semester: string;
  campus: string;
  avatar: string;
};

export type Post = {
  id: number;
  author: Student;
  time: string;
  body: string;
  mood: string;
  image?: string;
  tags: string[];
  community: string;
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
  expiresIn: string;
  viewers: number;
  tags: string[];
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
  description: string;
  topPost: string;
};

export type CampusEvent = {
  id: number;
  title: string;
  date: string;
  location: string;
  category: string;
  attendees: number;
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
  image?: string;
};

export type Report = {
  id: number;
  target: string;
  reason: string;
  severity: "Low" | "Medium" | "High";
  status: "Open" | "Reviewing" | "Resolved";
};
