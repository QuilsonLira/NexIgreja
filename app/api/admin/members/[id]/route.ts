import {
  adminBody,
  adminJson,
  adminRouteError,
  positiveId,
} from "@/lib/admin/http";
import { normalizeMemberWriteInput } from "@/lib/members/name-normalization";
import type { MemberWriteInput } from "@/lib/members/types";
import { getMember, updateMember } from "@/lib/server/members";

type C = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: Request, c: C) {
  try {
    const id = positiveId((await c.params).id);
    return adminJson({
      ok: true,
      detail: await getMember(
        request,
        id,
        new URL(request.url).searchParams.get("print") === "1",
      ),
    });
  } catch (error) {
    return adminRouteError(error);
  }
}

export async function PATCH(request: Request, c: C) {
  try {
    const input = normalizeMemberWriteInput(
      (await adminBody(request)) as unknown as MemberWriteInput,
    );
    const member = await updateMember(
      request,
      positiveId((await c.params).id),
      input,
    );
    return adminJson({
      ok: true,
      member,
      message: "Membro atualizado com sucesso.",
    });
  } catch (error) {
    return adminRouteError(error);
  }
}
