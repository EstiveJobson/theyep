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
  Student,
  StudyGroup,
  Trend,
} from "../src/types";

export type EventVoteChoice = "true" | "false";

export type EventAuthorStats = {
  posted: number;
  real: number;
  fake: number;
  blockedUntil?: string;
};

export type EventCreatePayload = {
  title: string;
  category: string;
  location: string;
  startsAt: string;
  author: Student;
};

export type EventUpdatePayload = {
  title: string;
  category: string;
  location: string;
  startsAt: string;
  authorHandle: string;
};

export type EventVotePayload = {
  authorHandle: string;
  choice: EventVoteChoice;
};

export type TheYepDatabase = {
  profiles: Record<string, unknown>;
  posts: Post[];
  commentsByPost: Record<string, PostComment[]>;
  postReactions: Record<string, ReactionKey[]>;
  drops: Drop[];
  directConversations: DirectConversation[];
  communities: Community[];
  joinedCommunities: Record<string, number[]>;
  events: CampusEvent[];
  eventVotes: Record<string, EventVoteChoice>;
  rsvps: Record<string, number[]>;
  studyGroups: StudyGroup[];
  joinedGroups: Record<string, number[]>;
  lostFound: LostFound[];
  reports: Report[];
  trends: Trend[];
  follows: Record<string, string[]>;
  notifications: Notification[];
};
