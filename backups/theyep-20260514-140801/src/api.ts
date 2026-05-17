import type {
  CampusEvent,
  Community,
  DirectConversation,
  DirectMessage,
  DirectMessageWindow,
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
} from "./types";

export type EventVoteChoice = "true" | "false";

export type BootstrapData<TProfile> = {
  profile?: TProfile | null;
  posts: Post[];
  commentsByPost: Record<number, PostComment[]>;
  userReactions: Record<number, ReactionKey[]>;
  drops: Drop[];
  directConversations: DirectConversation[];
  communities: Community[];
  communityMembers: Record<number, Student[]>;
  joinedCommunities: number[];
  events: CampusEvent[];
  eventVotes: Record<number, EventVoteChoice>;
  rsvps: number[];
  studyGroups: StudyGroup[];
  joinedGroups: number[];
  lostFound: LostFound[];
  reports: Report[];
  trends: Trend[];
  follows: string[];
  followers: string[];
  notifications: Notification[];
  knownStudents: Student[];
};

type EventsResponse = {
  events: CampusEvent[];
  event?: CampusEvent;
  eventVotes?: Record<number, EventVoteChoice>;
  rsvps?: number[];
  userVote?: EventVoteChoice | null;
};

type EventPayload = {
  title: string;
  category: string;
  location: string;
  startsAt: string;
};

type CommunityJoinResponse = {
  communities: Community[];
  communityMembers: Record<number, Student[]>;
  joinedCommunities: number[];
};

type GroupJoinResponse = {
  studyGroups: StudyGroup[];
  joinedGroups: number[];
};

type ReportsResponse = {
  reports: Report[];
};

type SocialResponse = {
  follows: string[];
  followers: string[];
  notifications?: Notification[];
};

type DirectResponse = {
  directConversations: DirectConversation[];
  conversation: DirectConversation;
};

type LostFoundResponse = {
  lostFound: LostFound[];
  directConversations?: DirectConversation[];
  conversation?: DirectConversation;
};

type NotificationsResponse = {
  notifications: Notification[];
};

type DirectMessagesResponse = {
  messages: DirectMessage[];
  messageWindow: DirectMessageWindow;
};

type UploadResponse = {
  url: string;
  filename: string;
  contentType: string;
  size: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const data = (await response.json()) as { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Backend request failed.");
  }

  return data as T;
}

function handleQuery(handle: string) {
  return `handle=${encodeURIComponent(handle)}`;
}

export async function fetchBootstrap<TProfile>(handle: string) {
  return request<BootstrapData<TProfile>>(`/api/bootstrap?${handleQuery(handle)}`);
}

export async function saveProfileToBackend<TProfile>(handle: string, profile: TProfile) {
  return request<{ profile: TProfile }>(`/api/profiles/${encodeURIComponent(handle)}`, {
    method: "PUT",
    body: JSON.stringify(profile),
  });
}

export async function uploadMediaFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/uploads", {
    method: "POST",
    body: formData,
  });
  const data = (await response.json()) as Partial<UploadResponse> & { error?: string };

  if (!response.ok || !data.url) {
    throw new Error(data.error ?? "Could not upload this file.");
  }

  return data as UploadResponse;
}

export async function createFeedPost(payload: {
  author: Student;
  body: string;
  mood: string;
  image?: string;
  video?: string;
}) {
  return request<BootstrapData<unknown>>("/api/posts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createCommunity(payload: {
  author: Student;
  name: string;
  category: string;
  description: string;
  accent: string;
  avatar?: string;
}) {
  return request<CommunityJoinResponse>("/api/communities", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createCommunityFeedPost(
  communityId: number,
  payload: { author: Student; body: string; mood: string; visibility?: "community" | "both" },
) {
  return request<BootstrapData<unknown>>(`/api/communities/${communityId}/posts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function reactToFeedPost(postId: number, reaction: ReactionKey, handle: string) {
  return request<BootstrapData<unknown>>(`/api/posts/${postId}/reactions/${reaction}`, {
    method: "POST",
    body: JSON.stringify({ handle }),
  });
}

export async function createPostComment(postId: number, payload: { author: Student; body: string }) {
  return request<BootstrapData<unknown>>(`/api/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createPostReply(
  postId: number,
  parentId: string,
  payload: { author: Student; body: string },
) {
  return request<BootstrapData<unknown>>(
    `/api/posts/${postId}/comments/${encodeURIComponent(parentId)}/replies`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteFeedPost(postId: number, handle: string) {
  return request<BootstrapData<unknown>>(`/api/posts/${postId}`, {
    method: "DELETE",
    body: JSON.stringify({ handle }),
  });
}

export async function deletePostComment(postId: number, commentId: string, handle: string) {
  return request<BootstrapData<unknown>>(
    `/api/posts/${postId}/comments/${encodeURIComponent(commentId)}`,
    {
      method: "DELETE",
      body: JSON.stringify({ handle }),
    },
  );
}

export async function createDropPost(payload: { author: Student; body: string; image?: string }) {
  return request<BootstrapData<unknown>>("/api/drops", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function startDirectConversation(payload: {
  author: Student;
  recipientHandle?: string;
  recipientHandles?: string[];
  body: string;
  image?: string;
  title?: string;
  isGroup?: boolean;
  avatar?: string;
}) {
  return request<DirectResponse>("/api/direct/conversations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendDirectMessage(
  conversationId: string,
  payload: { author: Student; body: string; image?: string },
) {
  return request<DirectResponse>(
    `/api/direct/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function fetchDirectMessages(
  conversationId: string,
  params: { handle: string; before?: string; after?: string; limit?: number },
) {
  const searchParams = new URLSearchParams({ handle: params.handle });
  if (params.before) searchParams.set("before", params.before);
  if (params.after) searchParams.set("after", params.after);
  if (params.limit) searchParams.set("limit", String(params.limit));

  return request<DirectMessagesResponse>(
    `/api/direct/conversations/${encodeURIComponent(conversationId)}/messages?${searchParams.toString()}`,
  );
}

export async function toggleFollowUser(handle: string, targetHandle: string) {
  return request<SocialResponse>(`/api/users/${encodeURIComponent(targetHandle)}/follow`, {
    method: "POST",
    body: JSON.stringify({ handle }),
  });
}

export async function createLostFoundItem(payload: {
  author: Student;
  status: "Lost" | "Found";
  item: string;
  location: string;
  image?: string;
}) {
  return request<LostFoundResponse>("/api/lost-found", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function contactLostFoundItem(itemId: number, payload: { author: Student; body: string }) {
  return request<LostFoundResponse>(`/api/lost-found/${itemId}/contact`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteLostFoundItem(itemId: number, handle: string) {
  return request<LostFoundResponse>(`/api/lost-found/${itemId}`, {
    method: "DELETE",
    body: JSON.stringify({ handle }),
  });
}

export async function deleteCampusEvent(eventId: number, handle: string) {
  return request<EventsResponse>(`/api/events/${eventId}`, {
    method: "DELETE",
    body: JSON.stringify({ handle }),
  });
}

export async function deleteCommunityRequest(communityId: number, handle: string) {
  return request<CommunityJoinResponse>(`/api/communities/${communityId}`, {
    method: "DELETE",
    body: JSON.stringify({ handle }),
  });
}

export async function deleteProfileRequest(targetHandle: string, handle: string) {
  return request<BootstrapData<unknown>>(`/api/profiles/${encodeURIComponent(targetHandle)}`, {
    method: "DELETE",
    body: JSON.stringify({ handle }),
  });
}

export async function markNotificationsRead(handle: string) {
  return request<NotificationsResponse>("/api/notifications/read", {
    method: "PATCH",
    body: JSON.stringify({ handle }),
  });
}

export async function fetchCampusEvents(handle: string) {
  const data = await request<EventsResponse>(`/api/events?${handleQuery(handle)}`);
  return data;
}

export async function createCampusEvent(payload: EventPayload & { author: Student }) {
  return request<EventsResponse>("/api/events", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCampusEvent(
  eventId: number,
  payload: EventPayload & { authorHandle: string },
) {
  return request<EventsResponse>(`/api/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function voteCampusEvent(
  eventId: number,
  payload: { authorHandle: string; choice: EventVoteChoice },
) {
  return request<EventsResponse>(`/api/events/${eventId}/vote`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function toggleEventRsvp(eventId: number, handle: string) {
  return request<EventsResponse>(`/api/events/${eventId}/rsvp`, {
    method: "POST",
    body: JSON.stringify({ handle }),
  });
}

export async function toggleCommunityJoin(communityId: number, handle: string) {
  return request<CommunityJoinResponse>(`/api/communities/${communityId}/join`, {
    method: "POST",
    body: JSON.stringify({ handle }),
  });
}

export async function toggleStudyGroupJoin(groupId: number, handle: string) {
  return request<GroupJoinResponse>(`/api/study-groups/${groupId}/join`, {
    method: "POST",
    body: JSON.stringify({ handle }),
  });
}

export async function createReport(payload: { target: string; reason: string }) {
  return request<ReportsResponse>("/api/reports", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resolveReportRequest(reportId: number) {
  return request<ReportsResponse>(`/api/reports/${reportId}/resolve`, {
    method: "PATCH",
  });
}
