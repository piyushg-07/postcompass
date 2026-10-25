import { Button, Dialog, DialogClose, SheetContent, toast } from "@repo/ui";
import { useState } from "react";
import { jsonProblem } from "./text-editor";

/** Full-size editor for long text and JSON, opened from "Expand editor". */
export function ExpandEditor({
  target,
  onClose,
  onSave,
}: {
  target: { column: string; json: boolean; text: string } | null;
  onClose: () => void;
  onSave: (value: string | null) => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      {target && (
        <ExpandBody
          key={target.column}
          target={target}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function ExpandBody({
  target,
  onSave,
  onClose,
}: {
  target: { column: string; json: boolean; text: string };
  onSave: (value: string | null) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(target.text);
  const save = () => {
    const problem = target.json ? jsonProblem(text) : null;
    if (problem) {
      toast.error(problem);
      return;
    }
    onSave(target.json && !text.trim() ? null : text);
    onClose();
  };
  return (
    <SheetContent
      title={
        <>
          Editing value of: <span className="font-mono">{target.column}</span>
        </>
      }
      className="w-[720px]"
      footer={
        <>
          {target.json && (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => {
                try {
                  setText(JSON.stringify(JSON.parse(text), null, 2));
                } catch {
                  toast.error("Please enter a valid JSON");
                }
              }}
            >
              Prettify JSON
            </Button>
          )}
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant="primary" onClick={save}>
            Save value
          </Button>
        </>
      }
    >
      <textarea
        autoFocus
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            save();
          }
        }}
        className="h-full min-h-[420px] w-full resize-none rounded-card border border-border-strong bg-bg p-3 font-mono text-xs leading-relaxed text-fg outline-none select-text focus:border-accent"
      />
    </SheetContent>
  );
}
