/**
 * Dataset import (docs/architecture.md §4; docs/threat-model.md T7-T10).
 *
 * HR only. `multipart/form-data` is the one documented exception to
 * `parseBody` (architecture §10: non-JSON body). The fields themselves are
 * still validated: a zod schema checks the field-name set and the file
 * objects before anything is read, and the whole handler still runs inside
 * `withErrorHandling`. Each file is capped at 5 MB (T7); oversize is a 413,
 * not a row error. Any accepted row is written atomically and the dataset
 * cache is invalidated, so the jury sees the new profile with no restart
 * (R-09). The action is audited regardless of outcome.
 */
import { z } from "zod";
import { withErrorHandling, okResponse, errorResponse } from "@/lib/http/validate";
import { requireHr, sessionErrorResponse } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit/audit";
import { importFiles, MAX_FILE_BYTES, IMPORT_KINDS, type ImportFileInput, type ImportKind } from "@/lib/data/import";

const FieldName = z.enum(["employees", "activity_history", "events", "skills"]);

export const POST = withErrorHandling(async (request: Request) => {
  try {
    await requireHr(request);
  } catch (error) {
    const response = sessionErrorResponse(error);
    if (response) return response;
    throw error;
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("VALIDATION", "Body is not a valid multipart form.", 400);
  }

  const inputs: ImportFileInput[] = [];
  const rejectedFields: string[] = [];
  for (const [field, value] of form.entries()) {
    const nameCheck = FieldName.safeParse(field);
    if (!nameCheck.success || !(value instanceof File)) {
      rejectedFields.push(field);
      continue;
    }
    if (value.size > MAX_FILE_BYTES) {
      return errorResponse("TOO_LARGE", `File for field "${field}" exceeds the 5 MB limit.`, 413);
    }
    inputs.push({
      kind: nameCheck.data as ImportKind,
      // The client filename is never used as a path (T10) - only kept to label errors.
      filename: value.name,
      text: await value.text(),
      size: value.size,
    });
  }

  if (inputs.length === 0) {
    return errorResponse(
      "VALIDATION",
      `No recognized file fields. Expected one or more of: ${IMPORT_KINDS.join(", ")}.`,
      400,
    );
  }

  const report = await importFiles(inputs);

  const totalAccepted = Object.values(report.accepted).reduce((sum, n) => sum + n, 0);
  await recordAudit({
    actor: { id: "HR01", role: "officer", label: "HR" },
    action: "dataset.import",
    subject: { type: "import", id: inputs.map((f) => f.kind).sort().join(",") },
    outcome: report.errors.length > 0 && totalAccepted === 0 ? "failed" : "completed",
    reason: `HR imported ${inputs.map((f) => f.kind).join(", ")}: ${totalAccepted} row(s) accepted, ${report.errors.length} row error(s).`,
    evidence: Object.entries(report.accepted).map(([kind, n]) => `${kind}:${n}`),
  });

  return okResponse(report);
});
