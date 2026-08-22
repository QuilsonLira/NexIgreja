import { adminBody, adminJson, adminRouteError } from "@/lib/admin/http";
import { normalizeMemberWriteInput } from "@/lib/members/name-normalization";
import type { MemberWriteInput } from "@/lib/members/types";
import { createMember, listMembers } from "@/lib/server/members";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return adminJson({
      ok: true,
      result: await listMembers(
        request,
        Object.fromEntries(new URL(request.url).searchParams),
      ),
    });
  } catch (error) {
    return adminRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = normalizeMemberWriteInput(
      (await adminBody(request)) as unknown as MemberWriteInput,
    );
    const member = await createMember(request, input);
    return adminJson(
      {
        ok: true,
        member,
        message: `Membro cadastrado com sucesso. Código do membro: ${member.memberCode}`,
      },
      201,
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
