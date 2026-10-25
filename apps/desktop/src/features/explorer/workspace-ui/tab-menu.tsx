import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  toast,
} from "@repo/ui";
import {
  Blocks,
  Copy,
  CopyPlus,
  Eye,
  FunctionSquare,
  Hash,
  List,
  Network,
  ShieldCheck,
  Table2,
  TerminalSquare,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { OBJECT_GROUP_TITLES } from "../tabs/objects-tab";
import type { Tab } from "../workspace-store";

export function tabLabel(tab: Tab): { icon: ReactNode; label: string } {
  switch (tab.type) {
    case "table":
      return {
        icon:
          tab.kind === "view" || tab.kind === "materialized_view" ? (
            <Eye />
          ) : (
            <Table2 />
          ),
        label: tab.name,
      };
    case "query":
      return { icon: <TerminalSquare />, label: tab.title };
    case "definition":
      return {
        icon: tab.kind === "function" ? <FunctionSquare /> : <Hash />,
        label: tab.title,
      };
    case "diagram":
      return { icon: <Network />, label: `Diagram · ${tab.schema}` };
    case "extensions":
      return { icon: <Blocks />, label: `Extensions · ${tab.database}` };
    case "policies":
      return { icon: <ShieldCheck />, label: `Policies · ${tab.schema}` };
    case "objects":
      return {
        icon: <List />,
        label: `${OBJECT_GROUP_TITLES[tab.group]} · ${tab.schema}`,
      };
  }
}

/** Right-click menu of a tab. */
export function TabMenu({
  tab,
  onClose,
  onCloseOthers,
  onCloseRight,
  onCloseAll,
  onDuplicate,
  onView,
  isLast,
  isOnly,
}: {
  tab: Tab;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseRight: () => void;
  onCloseAll: () => void;
  onDuplicate?: () => void;
  onView?: (view: "data" | "structure") => void;
  isLast: boolean;
  isOnly: boolean;
}) {
  const copy = (text: string) =>
    void navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Copied"));
  return (
    <ContextMenuContent>
      {onView && (
        <>
          <ContextMenuItem icon={<Table2 />} onSelect={() => onView("data")}>
            View data
          </ContextMenuItem>
          <ContextMenuItem icon={<List />} onSelect={() => onView("structure")}>
            View structure
          </ContextMenuItem>
          {tab.type === "table" && (
            <ContextMenuItem
              icon={<Copy />}
              onSelect={() => copy(`${tab.schema}.${tab.name}`)}
            >
              Copy name
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
        </>
      )}
      {onDuplicate && (
        <>
          <ContextMenuItem icon={<CopyPlus />} onSelect={onDuplicate}>
            Duplicate query
          </ContextMenuItem>
          {tab.type === "query" && (
            <ContextMenuItem icon={<Copy />} onSelect={() => copy(tab.sql)}>
              Copy SQL
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuItem icon={<X />} shortcut="Ctrl W" onSelect={onClose}>
        Close
      </ContextMenuItem>
      <ContextMenuItem disabled={isOnly} onSelect={onCloseOthers}>
        Close others
      </ContextMenuItem>
      <ContextMenuItem disabled={isLast} onSelect={onCloseRight}>
        Close tabs to the right
      </ContextMenuItem>
      <ContextMenuItem onSelect={onCloseAll}>Close all</ContextMenuItem>
    </ContextMenuContent>
  );
}
