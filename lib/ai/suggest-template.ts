/**
 * Deterministic kk/ru/en development-suggestion text, built only from
 * `SuggestContext` (facts `lib/domain/suggest.ts` already computed). Used
 * both as the AI-suggestion fallback template (`lib/ai/suggest.ts`) and by
 * the offline mock scenario (`lib/ai/scenarios.ts`) - the same split
 * `lib/ai/rationale.ts` + `lib/ai/template.ts` use for explanations, so both
 * paths stay trivially grounded (every number/id is copied verbatim, never
 * invented) and read as prose, not a key=value dump.
 */
import type { Locale, Suggestion, SuggestionType } from "../contracts";
import type { SuggestBlockedEvent, SuggestContext, SuggestGapSkill, SuggestMasteredSkill } from "../domain/suggest";
import { tf } from "../i18n/dict";

/**
 * Every suggestion title is built HERE, in code, from an i18n key + the
 * skill/event name already present in `context` - never from model text (a
 * live run once produced an invented "Peer Mentorship Program" title; this
 * makes that impossible). Used both by the deterministic template below and
 * by `lib/ai/suggest.ts` to re-title validated model suggestions.
 */
export function buildSuggestionTitle(
  locale: Locale,
  type: SuggestionType,
  skillName: string,
  eventTitle?: string,
): string {
  if (type === "prerequisite_path") {
    return tf(locale, "suggest.item.title.prerequisite_path", { skill: skillName, event: eventTitle ?? "" });
  }
  return tf(locale, `suggest.item.title.${type}`, { skill: skillName });
}

/** `blocked.missingPrereq` is always set here - callers only reach this for
 * an "unlockable" event (see lib/domain/suggest.ts), and the real blocker
 * (its missing prerequisite skill/levels) is what the text must describe,
 * not the trajectory gap skill the event eventually develops. */
function prereqRationale(locale: Locale, blocked: SuggestBlockedEvent): string {
  const prereq = blocked.missingPrereq!;
  if (locale === "ru") {
    return `Текущий уровень ${prereq.effective} из ${prereq.required} по «${prereq.name}» блокирует «${blocked.title}». Обсудите с руководителем короткий путь до нужного уровня.`;
  }
  if (locale === "kk") {
    return `«${prereq.name}» бойынша ағымдағы деңгей ${prereq.effective}/${prereq.required} «${blocked.title}» іс-шарасын бөгейді. Жетекшіңізбен қажетті деңгейге жету жолын талқылаңыз.`;
  }
  return `Current level ${prereq.effective} of ${prereq.required} on "${prereq.name}" is blocking "${blocked.title}". Discuss a short path to that level with your manager before it opens up.`;
}

function maintainRationale(locale: Locale, mastered: SuggestMasteredSkill): string {
  if (locale === "ru") {
    return `Уровень ${mastered.level} по «${mastered.name}» уже соответствует требованиям роли. Предложите наставничество или короткую сессию обмена опытом для коллег.`;
  }
  if (locale === "kk") {
    return `«${mastered.name}» бойынша ${mastered.level} деңгейі рөл талабына сай келеді. Әріптестеріңізге тәлімгерлік немесе тәжірибе бөлісу сессиясын ұсыныңыз.`;
  }
  return `Level ${mastered.level} on "${mastered.name}" already meets the role requirement. Offer to mentor a colleague or run a short knowledge-sharing session on it.`;
}

function requestRationale(locale: Locale, gap: SuggestGapSkill): string {
  if (locale === "ru") {
    return `По «${gap.name}» разрыв ${gap.effective} из ${gap.required}, но подходящего курса в каталоге сейчас нет. Обсудите с HR, чтобы добавить его.`;
  }
  if (locale === "kk") {
    return `«${gap.name}» бойынша алшақтық ${gap.effective}/${gap.required}, бірақ каталогта сәйкес курс жоқ. HR-мен қосу мүмкіндігін талқылаңыз.`;
  }
  return `There is a gap of ${gap.effective} of ${gap.required} on "${gap.name}" but no matching catalogue course exists yet. Ask HR about adding one.`;
}

/** Always returns at least one suggestion when `context.gapSkills` is
 * non-empty, which `buildSuggestContext` guarantees for all three noStep
 * reasons this feature targets. */
export function buildTemplateSuggestions(context: SuggestContext, locale: Locale): Suggestion[] {
  const out: Suggestion[] = [];
  const gap = context.gapSkills[0];
  // Only an "unlockable" blocked event (role+grade match, blocked solely by
  // prereqs-met - see lib/domain/suggest.ts) carries `missingPrereq`. If
  // none exists, PREREQ_BLOCKED falls through to the request_training
  // fallback below rather than describing an incoherent path.
  const unlockable = context.blockedEvents.find((b) => b.missingPrereq);

  if (context.noStep === "PREREQ_BLOCKED" && unlockable) {
    out.push({
      type: "prerequisite_path",
      skill_id: unlockable.missingPrereq!.skill_id,
      event_ids: [unlockable.event_id],
      title: buildSuggestionTitle(locale, "prerequisite_path", unlockable.missingPrereq!.name, unlockable.title),
      rationale: prereqRationale(locale, unlockable),
      generatedBy: "template",
    });
  } else if (context.noStep === "ALL_DONE" && context.masteredSkills[0]) {
    const mastered = context.masteredSkills[0];
    out.push({
      type: "maintain_and_share",
      skill_id: mastered.skill_id,
      event_ids: [],
      title: buildSuggestionTitle(locale, "maintain_and_share", mastered.name),
      rationale: maintainRationale(locale, mastered),
      generatedBy: "template",
    });
  }

  if (out.length === 0 && gap) {
    out.push({
      type: "request_training",
      skill_id: gap.skill_id,
      event_ids: [],
      title: buildSuggestionTitle(locale, "request_training", gap.name),
      rationale: requestRationale(locale, gap),
      generatedBy: "template",
    });
  }

  return out;
}
