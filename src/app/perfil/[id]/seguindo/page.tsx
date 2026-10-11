import { FollowListPage } from "@/components/follow-list-page";

export default function SeguindoPage({ params }: { params: Promise<{ id: string }> }) {
  return <FollowListPage params={params} direction="seguindo" />;
}
