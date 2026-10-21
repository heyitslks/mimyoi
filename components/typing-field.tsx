"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type {
  ClipboardEvent,
  CompositionEvent,
  Ref,
  SyntheticEvent,
} from "react";

import { ERROR_GRACE_MS } from "@/lib/rules";

/** Anything other than plain, single-character typing is rejected. */
const BLOCKED_INPUT_TYPES = new Set([
  "deleteByCut",
  "deleteByDrag",
  "deleteContent",
  "deleteContentBackward",
  "deleteContentForward",
  "deleteEntireSoftLine",
  "deleteHardLineBackward",
  "deleteHardLineForward",
  "deleteSoftLineBackward",
  "deleteSoftLineForward",
  "deleteWordBackward",
  "deleteWordForward",
  "historyRedo",
  "historyUndo",
  "insertFromDrop",
  "insertFromPaste",
  "insertFromPasteAsQuotation",
  "insertFromYank",
  "insertLink",
  "insertReplacementText",
  "insertTranspose",
]);

interface TypingFieldProps {
  disabled: boolean;
  onComplete: (text: string) => void;
  onError: (typedCorrectly: number) => void;
  onKeystroke: () => void;
  onPaste: () => void;
  ref?: Ref<HTMLInputElement | null>;
  target: string;
}

const preventDefault = (event: SyntheticEvent) => {
  event.preventDefault();
};

/**
 * The input the player types into. Accepts exactly one correct character at
 * a time; anything else restarts the line. Deleting, pasting, dropping,
 * autocorrect and undo are all blocked.
 * @param props - Target text and callbacks.
 * @returns The input element.
 */
export const TypingField = ({
  disabled,
  onComplete,
  onError,
  onKeystroke,
  onPaste,
  ref,
  target,
}: TypingFieldProps) => {
  const input = useRef<HTMLInputElement>(null);
  const accepted = useRef("");
  const composing = useRef(false);
  const graceUntil = useRef(0);

  useImperativeHandle<HTMLInputElement | null, HTMLInputElement | null>(
    ref,
    () => input.current,
    []
  );

  useEffect(() => {
    const element = input.current;

    const onBeforeInput = (event: InputEvent) => {
      if (!BLOCKED_INPUT_TYPES.has(event.inputType)) {
        return;
      }

      event.preventDefault();

      if (event.inputType.startsWith("insertFrom")) {
        onPaste();
      }
    };

    element?.addEventListener("beforeinput", onBeforeInput);

    return () => element?.removeEventListener("beforeinput", onBeforeInput);
  }, [onPaste]);

  useEffect(() => {
    if (!disabled) {
      input.current?.focus();
    }
  }, [disabled]);

  // A keyboard that composes words commits them several letters at once.
  const check = (element: HTMLInputElement, allowWord: boolean) => {
    const { value } = element;
    const previous = accepted.current;

    if (value === previous) {
      return;
    }

    // Deleting is not a thing here: snap back to what was accepted.
    if (value.length < previous.length) {
      element.value = previous;

      return;
    }

    onKeystroke();

    const grows = allowWord
      ? value.startsWith(previous)
      : value.length === previous.length + 1 && value.startsWith(previous);

    if (grows && target.startsWith(value)) {
      accepted.current = value;

      if (value === target) {
        onComplete(value);
      }

      return;
    }

    accepted.current = "";
    element.value = "";

    // Autocorrect swaps a word and then adds the space, which arrives as a
    // second wrong input. Everything right after an error is the same error.
    const now = Date.now();

    if (now < graceUntil.current) {
      return;
    }

    graceUntil.current = now + ERROR_GRACE_MS;
    onError(previous.length);
  };

  const handleInput = (event: SyntheticEvent<HTMLInputElement>) => {
    if (!composing.current) {
      check(event.currentTarget, false);
    }
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLInputElement>) => {
    composing.current = false;
    check(event.currentTarget, true);
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    onPaste();
  };

  return (
    <input
      aria-label="Hier tippen"
      autoCapitalize="off"
      autoComplete="off"
      autoCorrect="off"
      className="border-muted text-foreground caret-accent focus:border-accent w-full border-0 border-b-2 bg-transparent py-4 font-mono text-lg outline-none disabled:opacity-50"
      data-1p-ignore
      data-bwignore
      data-enable-grammarly="false"
      data-form-type="other"
      data-gramm="false"
      data-gramm_editor="false"
      data-lpignore="true"
      disabled={disabled}
      enterKeyHint="done"
      inputMode="text"
      name="mimi-typing"
      onCompositionEnd={handleCompositionEnd}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCopy={preventDefault}
      onCut={preventDefault}
      onDragOver={preventDefault}
      onDrop={preventDefault}
      onInput={handleInput}
      onPaste={handlePaste}
      ref={input}
      spellCheck={false}
      type="text"
    />
  );
};
