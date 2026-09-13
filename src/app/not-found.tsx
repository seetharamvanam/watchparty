import { StatusScreen } from "@/components/room/status-screen";

export default function NotFound() {
  return (
    <StatusScreen
      title="That page isn’t here"
      body="Head back to the lobby and create or join a room."
    />
  );
}
