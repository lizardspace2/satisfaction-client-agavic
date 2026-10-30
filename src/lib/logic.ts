import type { AnswerValue, AnswersMap, ConditionRule, Question } from './types'

// ---------------------------------------------------------------------------
// Moteur de logique conditionnelle
// conditions : { combinator: 'and'|'or', rules: [{question_id, op, value}] }
// Pas de règles => question toujours affichée.
// ---------------------------------------------------------------------------

function compare(rule: ConditionRule, answer: AnswerValue): boolean {
  if (answer === null || answer === undefined || answer === '') {
    // Une question sans réponse ne satisfait jamais une condition
    return false
  }
  const expected = rule.value
  const aNum = typeof answer === 'number' ? answer : Number(answer)
  const eNum = typeof expected === 'number' ? expected : Number(expected)
  const bothNumeric = !Number.isNaN(aNum) && !Number.isNaN(eNum)

  switch (rule.op) {
    case 'eq':
      return bothNumeric ? aNum === eNum : String(answer) === String(expected)
    case 'neq':
      return bothNumeric ? aNum !== eNum : String(answer) !== String(expected)
    case 'lt':  return bothNumeric && aNum < eNum
    case 'lte': return bothNumeric && aNum <= eNum
    case 'gt':  return bothNumeric && aNum > eNum
    case 'gte': return bothNumeric && aNum >= eNum
    case 'contains':
      return Array.isArray(answer)
        ? answer.map(String).includes(String(expected))
        : String(answer).toLowerCase().includes(String(expected).toLowerCase())
    default:
      return true
  }
}

export function isQuestionVisible(question: Question, answers: AnswersMap): boolean {
  const rules = question.conditions?.rules ?? []
  if (rules.length === 0) return true
  const results = rules.map((r) => compare(r, answers[r.question_id]))
  return (question.conditions?.combinator ?? 'and') === 'or'
    ? results.some(Boolean)
    : results.every(Boolean)
}

/** Questions visibles dans l'ordre, compte tenu des réponses actuelles. */
export function visibleQuestions(questions: Question[], answers: AnswersMap): Question[] {
  return [...questions]
    .sort((a, b) => a.position - b.position)
    .filter((q) => isQuestionVisible(q, answers))
}

/** Valeur d'une question portant un "role" métier (overall, nps, comment). */
export function answerByRole(
  questions: Question[],
  answers: AnswersMap,
  role: 'overall' | 'nps' | 'comment'
): AnswerValue {
  const q = questions.find((x) => x.options?.role === role)
  return q ? answers[q.id] ?? null : null
}

/** Un type de question produit-il une réponse ? ("message" = écran informatif) */
export function isAnswerable(q: Question): boolean {
  return q.type !== 'message'
}

/** Validation d'une réponse selon le type de question. */
export function isAnswerValid(q: Question, value: AnswerValue): boolean {
  if (!isAnswerable(q)) return true
  if (!q.required) {
    if (value === null || value === undefined || value === '') return true
  } else if (value === null || value === undefined || value === '') {
    return false
  }
  switch (q.type) {
    case 'score_10':
    case 'nps':
      return typeof value === 'number' && value >= 0 && value <= 10
    case 'stars':
      return typeof value === 'number' && value >= 1 && value <= 5
    case 'multi_choice':
      return !q.required || (Array.isArray(value) && value.length > 0)
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))
    default:
      return true
  }
}
