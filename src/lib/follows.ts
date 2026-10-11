export type FollowStats = {
  followers: number;
  following: number;
  viewerFollows: boolean;
};

export type FollowDirection = "seguidores" | "seguindo";

export type FollowPerson = {
  id: string;
  name: string;
  avatarUrl: string | null;
  schoolShortName: string | null;
  followedAt: string;
};

function formatCount(count: number): string {
  return count.toLocaleString("pt-BR");
}

export function followerLabel(count: number): string {
  return count === 1 ? "1 seguidor" : `${formatCount(count)} seguidores`;
}

export function followingLabel(count: number): string {
  return `${formatCount(count)} seguindo`;
}
