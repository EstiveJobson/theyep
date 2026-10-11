import { FollowListPage } from "@/components/follow-list-page";

export default function SeguidoresPage({ params }: { params: Promise<{ id: string }> }) {
  return <FollowListPage params={params} direction="seguidores" />;
}
