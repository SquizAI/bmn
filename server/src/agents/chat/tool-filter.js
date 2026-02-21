// server/src/agents/chat/tool-filter.js
//
// Role-based tool filtering for the chat agent.
// Determines which tools a user can access based on their
// platform role (profiles.role) and org role (organization_members.role).

/**
 * Role hierarchy from lowest to highest privilege.
 * @type {string[]}
 */
const ROLE_HIERARCHY = ['user', 'manager', 'admin', 'owner', 'platform_admin'];

/**
 * Tool category assignments per effective role.
 * Each role gets its own categories.
 * @type {Record<string, string[]>}
 */
const ROLE_TOOL_CATEGORIES = {
  user:           ['brand_read', 'brand_modify', 'generation', 'account'],
  manager:        ['brand_read', 'brand_modify', 'generation', 'account'],
  admin:          ['brand_read', 'brand_modify', 'generation', 'account', 'organization'],
  owner:          ['brand_read', 'brand_modify', 'generation', 'account', 'organization'],
  platform_admin: ['brand_read', 'brand_modify', 'generation', 'account', 'organization', 'platform_admin'],
};

/**
 * Determine the user's effective role for tool filtering.
 * Platform role trumps org role.
 *
 * @param {string} profileRole - profiles.role (user, admin, super_admin)
 * @param {string|null} orgRole - organization_members.role (owner, admin, manager, member)
 * @returns {'user'|'manager'|'admin'|'owner'|'platform_admin'}
 */
export function getEffectiveRole(profileRole, orgRole) {
  if (profileRole === 'super_admin' || profileRole === 'admin') {
    return 'platform_admin';
  }
  if (orgRole === 'owner') return 'owner';
  if (orgRole === 'admin') return 'admin';
  if (orgRole === 'manager') return 'manager';
  return 'user';
}

/**
 * Get the tool categories allowed for a given effective role.
 *
 * @param {'user'|'manager'|'admin'|'owner'|'platform_admin'} effectiveRole
 * @returns {string[]}
 */
export function getAllowedCategories(effectiveRole) {
  return ROLE_TOOL_CATEGORIES[effectiveRole] || ROLE_TOOL_CATEGORIES.user;
}

/**
 * Filter a list of tools by the user's effective role.
 *
 * @param {Array<{ name: string, category: string }>} tools - All tool definitions with category tags
 * @param {'user'|'manager'|'admin'|'owner'|'platform_admin'} effectiveRole
 * @returns {Array<{ name: string, category: string }>}
 */
export function filterToolsByRole(tools, effectiveRole) {
  const allowed = getAllowedCategories(effectiveRole);
  return tools.filter((tool) => allowed.includes(tool.category));
}

export { ROLE_HIERARCHY, ROLE_TOOL_CATEGORIES };
