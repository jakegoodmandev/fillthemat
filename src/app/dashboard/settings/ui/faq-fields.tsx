"use client";

import { LIMITS } from "../schemas";
import { TextAreaField, TextField } from "./controls";

export function FaqFields({
  values,
  setField,
  errorFor,
  disabled = false,
}: {
  values: Record<string, string>;
  setField: (name: string, value: string) => void;
  errorFor: (name: string) => string | undefined;
  disabled?: boolean;
}) {
  return (
    <>
      <TextField
        label="Question"
        name="question"
        required
        disabled={disabled}
        maxLength={LIMITS.faqQuestion}
        showCount
        value={values.question}
        onValueChange={(value) => setField("question", value)}
        error={errorFor("question")}
        placeholder="Do we need a uniform for the first class?…"
      />
      <TextAreaField
        label="Answer"
        name="answer"
        required
        disabled={disabled}
        rows={5}
        maxLength={LIMITS.faqAnswer}
        value={values.answer}
        onValueChange={(value) => setField("answer", value)}
        error={errorFor("answer")}
        placeholder="No. Comfortable clothes are fine for the trial class…"
      />
    </>
  );
}
