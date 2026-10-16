import clsx from "clsx";
import { FC, ReactNode } from "react";

import {
  RowSelectCheckbox,
  useSelectableRow,
} from "../../selection/RowSelectCheckbox";

import styles from "./EventRow.module.css";

const kDefaultIcon = "bi bi-table";

interface EventRowProps {
  /** The row's node id; enables the evidence-selection checkbox. */
  eventNodeId?: string;
  title: ReactNode;
  icon: string;
  iconClassName?: string;
  className?: string;
  children?: ReactNode | ReactNode[];
  /** Optional full-width content rendered below the title row, inside the card. */
  below?: ReactNode;
}
/**
 * Renders the EventRow component.
 */
export const EventRow: FC<EventRowProps> = ({
  eventNodeId,
  title,
  icon,
  iconClassName,
  className,
  children,
  below,
}) => {
  const rowSelection = useSelectableRow(eventNodeId);
  const contentEl = title ? (
    <>
      <div
        className={clsx(
          "text-size-small",
          styles.title,
          rowSelection && styles.selectable,
          className
        )}
      >
        {rowSelection ? (
          <RowSelectCheckbox selection={rowSelection} item="event" />
        ) : null}
        <i className={clsx(icon || kDefaultIcon, iconClassName)} />
        <div className={clsx("text-style-label")}>{title}</div>
        <div>{children}</div>
      </div>
      {below ? (
        <div className={clsx("text-size-small", styles.below)}>{below}</div>
      ) : null}
    </>
  ) : (
    ""
  );

  return (
    <div
      className={clsx(
        "card",
        styles.contents,
        rowSelection?.selected && styles.selected
      )}
    >
      {contentEl}
    </div>
  );
};
