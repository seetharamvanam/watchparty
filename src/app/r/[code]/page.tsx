import { RoomShell } from "@/components/room/room-shell";

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { code } = await params;
  const { e } = await searchParams;
  return <RoomShell code={code} initialError={e} />;
}
