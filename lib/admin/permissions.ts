export const PERMISSION_DEFINITIONS = [
  { code: "USUARIOS_VISUALIZAR", label: "Visualizar usuários", group: "Usuários" },
  { code: "USUARIOS_CRIAR", label: "Criar usuários", group: "Usuários" },
  { code: "USUARIOS_EDITAR", label: "Editar usuários", group: "Usuários" },
  { code: "USUARIOS_DESATIVAR", label: "Ativar e desativar usuários", group: "Usuários" },
  {
    code: "USUARIOS_REDEFINIR_SENHA",
    label: "Redefinir senha e encerrar sessões",
    group: "Usuários"
  },
  { code: "UNIDADES_VISUALIZAR", label: "Visualizar unidades", group: "Unidades" },
  { code: "UNIDADES_CRIAR", label: "Criar unidades", group: "Unidades" },
  { code: "UNIDADES_EDITAR", label: "Editar, ativar e desativar unidades", group: "Unidades" },
  { code: "ACESSOS_VISUALIZAR", label: "Visualizar histórico de acessos", group: "Segurança" }
] as const;

export type PermissionCode = (typeof PERMISSION_DEFINITIONS)[number]["code"];

export const PERMISSION_CODES = PERMISSION_DEFINITIONS.map((permission) => permission.code) as [
  PermissionCode,
  ...PermissionCode[]
];

const permissionSet = new Set<string>(PERMISSION_CODES);

export function isPermissionCode(value: string): value is PermissionCode {
  return permissionSet.has(value);
}
