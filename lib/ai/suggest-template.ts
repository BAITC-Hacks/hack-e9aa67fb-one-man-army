/**
 * Deterministic kk/ru/en development-suggestion text, built only from
 * `SuggestContext` (facts `lib/domain/suggest.ts` already computed). Used
 * both as the AI-suggestion fallback template (`lib/ai/suggest.ts`) and by
 * the offline mock scenario (`lib/ai/scenarios.ts`) - the same split
 * `lib/ai/rationale.ts` + `lib/ai/template.ts` use for explanations, so both
 * paths stay trivially grounded (every number/id is copied verbatim, never
 * invented) and read as prose, not a key=value dump.
 */
import type { Locale, Suggestion } from "../contracts";
import type { SuggestBlockedEvent, SuggestContext, SuggestGapSkill, SuggestMasteredSkill } from "../domain/suggest";

function prereqTitle(locale: Locale, skillName: string): string {
  if (locale === "ru") return `Сначала закрыть требование по «${skillName}»`;
  if (locale === "kk") return `Алдымен «${skillName}» бойынша алғышартты жабу`;
  return `Close the prerequisite for "${skillName}" first`;
}

function prereqRationale(locale: Locale, gap: SuggestGapSkill, blocked?: SuggestBlockedEvent): string {
  const detail = blocked ? blocked.detail : "";
  if (locale === "ru") {
    return `Текущий уровень ${gap.effective} из ${gap.required} по «${gap.name}» блокирует обучение${
      blocked ? ` («${blocked.title}»: ${detail})` : ""
    }. Обсудите с руководителем короткий путь до нужного уровня.`;
  }
  if (locale === "kk") {
    return `«${gap.name}» бойынша ағымдағы деңгей ${gap.effective}/${gap.required} оқытуды бөгейді${
      blocked ? ` («${blocked.title}»: ${detail})` : ""
    }. Жетекшіңізбен қажетті деңгейге жету жолын талқылаңыз.`;
  }
  return `Current level ${gap.effective} of ${gap.required} on "${gap.name}" is blocking the catalogue event${
    blocked ? ` ("${blocked.title}": ${detail})` : ""
  }. Discuss a short path to that level with your manager before it opens up.`;
}

function maintainTitle(locale: Locale, skillName: string): string {
  if (locale === "ru") return `Поделиться опытом по «${skillName}»`;
  if (locale === "kk") return `«${skillName}» бойынша тәжірибе бөлісу`;
  return `Share your expertise in "${skillName}"`;
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

function requestTitle(locale: Locale, skillName: string): string {
  if (locale === "ru") return `Запросить обучение по «${skillName}»`;
  if (locale === "kk") return `«${skillName}» бойынша оқытуды сұрау`;
  return `Ask HR to add training for "${skillName}"`;
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

  if (context.noStep === "PREREQ_BLOCKED" && gap) {
    const blocked = context.blockedEvents[0];
    out.push({
      type: "prerequisite_path",
      skill_id: gap.skill_id,
      event_ids: blocked ? [blocked.event_id] : undefined,
      title: prereqTitle(locale, gap.name),
      rationale: prereqRationale(locale, gap, blocked),
    });
  } else if (context.noStep === "ALL_DONE" && context.masteredSkills[0]) {
    const mastered = context.masteredSkills[0];
    out.push({
      type: "maintain_and_share",
      skill_id: mastered.skill_id,
      title: maintainTitle(locale, mastered.name),
      rationale: maintainRationale(locale, mastered),
    });
  }

  if (out.length === 0 && gap) {
    out.push({
      type: "request_training",
      skill_id: gap.skill_id,
      title: requestTitle(locale, gap.name),
      rationale: requestRationale(locale, gap),
    });
  }

  return out;
}
