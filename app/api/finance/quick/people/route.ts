import { adminJson, adminRouteError } from "@/lib/admin/http";
import { formatMemberCode } from "@/lib/members/policy";
import { requirePermission } from "@/lib/server/admin";
import { ApiError, database } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

type QuickSessionScope = {
  id: number;
  unit_id: number;
  unit_type: "CONVENCAO" | "MATRIZ" | "FILIAL";
};

type PersonRow = {
  id: number;
  member_number: number;
  full_name: string;
  matrix_id: number;
  branch_id: number | null;
  default_privacy: string;
  unit_name: string;
  unit_type: "MATRIZ" | "FILIAL";
};

export async function GET(request: Request) {
  try {
    const { session, permissions } = await requirePermission(
      request,
      "FINANCEIRO_LANCAMENTO_RAPIDO",
    );
    const params = new URL(request.url).searchParams;
    const sessionId = Number(params.get("sessionId") || 0);
    const query = (params.get("q") || "").trim().slice(0, 80);

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      throw new ApiError(400, "SESSAO_INVALIDA", "Sessão rápida inválida.");
    }
    if (query.length < 2) {
      return adminJson({ ok: true, result: { people: [] } });
    }

    const quickSession = await database()
      .prepare(
        "SELECT s.id,s.unit_id,u.type unit_type FROM finance_quick_sessions s JOIN organizational_units u ON u.id=s.unit_id AND u.tenant_id=s.tenant_id WHERE s.id=? AND s.tenant_id=? AND s.user_id=? AND s.status='EM_ANDAMENTO' AND u.status='ATIVO' AND u.archived_at IS NULL",
      )
      .bind(sessionId, session.user.tenantId, session.user.id)
      .first<QuickSessionScope>();

    if (!quickSession) {
      throw new ApiError(
        404,
        "SESSAO_NAO_ENCONTRADA",
        "Sessão rápida não encontrada.",
      );
    }
    if (session.activeContext?.unitId !== Number(quickSession.unit_id)) {
      throw new ApiError(
        403,
        "FORA_DO_ESCOPO",
        "Selecione a unidade desta sessão no topo antes de buscar contribuintes.",
      );
    }

    const canIncludeBranches =
      quickSession.unit_type === "MATRIZ" &&
      permissions.has("FINANCEIRO_CONTRIBUINTES_FILIAIS_PESQUISAR");
    const includeBranches =
      params.get("includeBranches") === "1" && canIncludeBranches;

    const where = [
      "p.tenant_id=?",
      "p.status NOT IN ('FALECIDO','TRANSFERIDO','DESLIGADO')",
    ];
    const args: unknown[] = [session.user.tenantId];

    if (quickSession.unit_type === "FILIAL") {
      where.push("p.branch_id=?");
      args.push(quickSession.unit_id);
    } else if (quickSession.unit_type === "MATRIZ") {
      where.push(
        includeBranches
          ? "p.matrix_id=?"
          : "p.matrix_id=? AND p.branch_id IS NULL",
      );
      args.push(quickSession.unit_id);
    } else {
      where.push("m.parent_id=?");
      args.push(quickSession.unit_id);
    }

    const numericQuery = query.replace(/\D/g, "");
    where.push(
      "(LOWER(p.full_name) LIKE LOWER(?) OR CAST(p.member_number AS CHAR) LIKE ?)",
    );
    args.push(`%${query}%`, `%${numericQuery || query}%`);

    const people = await database()
      .prepare(
        `SELECT p.id,p.member_number,p.full_name,p.matrix_id,p.branch_id,
          COALESCE(pref.default_privacy,'IDENTIFICADA') default_privacy,
          COALESCE(b.name,m.name) unit_name,
          CASE WHEN b.id IS NULL THEN 'MATRIZ' ELSE 'FILIAL' END unit_type
        FROM people p
        JOIN organizational_units m ON m.id=p.matrix_id AND m.tenant_id=p.tenant_id AND m.status='ATIVO' AND m.archived_at IS NULL
        LEFT JOIN organizational_units b ON b.id=p.branch_id AND b.tenant_id=p.tenant_id
        LEFT JOIN person_financial_preferences pref ON pref.person_id=p.id AND pref.tenant_id=p.tenant_id
        WHERE ${where.join(" AND ")}
          AND (p.branch_id IS NULL OR (b.status='ATIVO' AND b.archived_at IS NULL))
        ORDER BY LOWER(p.full_name)
        LIMIT 30`,
      )
      .bind(...args)
      .all<PersonRow>();

    return adminJson({
      ok: true,
      result: {
        people: people.results.map((person) => ({
          ...person,
          member_code: formatMemberCode(Number(person.member_number)),
        })),
        canIncludeBranches,
      },
    });
  } catch (error) {
    return adminRouteError(error);
  }
}
