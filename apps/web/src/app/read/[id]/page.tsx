import { Suspense } from "react";
import { Loading, ReaderClient } from "@/components/ClientOnly";

type Params = Promise<{ id: string }>;
type Search = Promise<{ [key: string]: string | string[] | undefined }>;

async function Reader({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { id } = await params;
  const { loc, passage, panel } = await searchParams;
  return (
    <ReaderClient
      bookId={id}
      jumpTo={typeof loc === "string" ? loc : undefined}
      passageId={typeof passage === "string" && /^\d+$/.test(passage) ? Number(passage) : undefined}
      openPanel={panel === "ask" || panel === "discuss" ? panel : undefined}
    />
  );
}

export default function ReadPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  return (
    <Suspense fallback={<Loading text="Opening your book…" />}>
      <Reader params={params} searchParams={searchParams} />
    </Suspense>
  );
}
