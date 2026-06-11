/**
 * Returns a SQL fragment that evaluates to true when a session has enough data
 * to be considered valid (i.e. not a completely empty/garbage record).
 *
 * @param alias - Optional table alias to prefix column names (e.g. 's' → 's.session_id').
 */
export function validSessionSql(alias?: string): string {
  const p = alias ? `${alias}.` : '';
  return `NOT (
    ${p}session_id = 'unknown'
    AND (${p}project_path IS NULL OR ${p}project_path = 'unknown')
    AND (${p}model IS NULL OR ${p}model = 'unknown')
    AND COALESCE(${p}message_count, 0) = 0
    AND COALESCE(${p}tool_call_count, 0) = 0
    AND COALESCE(${p}total_cost_usd, 0) = 0
  )`;
}

/**
 * Returns a SQL fragment that evaluates to true when a session is valid AND its
 * project is not hidden by the user.
 *
 * @param alias - Optional table alias to prefix column names.
 */
export function visibleSessionSql(alias?: string): string {
  const p = alias ? `${alias}.` : '';
  return `${validSessionSql(alias)}
  AND NOT EXISTS (SELECT 1 FROM hidden_projects hp WHERE hp.path = COALESCE(${p}project_path, 'unknown'))`;
}
