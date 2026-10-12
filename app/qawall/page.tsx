import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getQuestions } from "@/lib/qawall/actions";
import { QaWallClient } from "./qawall-client";

export default async function QaWallPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const questions = await getQuestions();

  return (
    <QaWallClient
      initialQuestions={questions}
      userId={session.user.id}
      userName={session.user.name}
      userRole={session.user.role}
    />
  );
}
