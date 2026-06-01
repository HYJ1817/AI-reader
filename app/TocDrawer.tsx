"use client";

import type { EpubTocItem } from "@/lib/epubNavigation";
import styles from "./page.module.css";

type Props = {
  items: EpubTocItem[];
  onSelect: (href: string) => void;
  onClose: () => void;
};

function TocList({
  items,
  depth,
  onSelect,
}: {
  items: EpubTocItem[];
  depth: number;
  onSelect: (href: string) => void;
}) {
  return (
    <ul className={styles.tocList}>
      {items.map((item) => (
        <li key={item.id} className={styles.tocRow}>
          <div className={styles.tocRowStack}>
            <button
              className={styles.tocRowButton}
              style={{ paddingLeft: 12 + depth * 20 }}
              onClick={() => onSelect(item.href)}
            >
              <span className={styles.tocRowLabel}>{item.label}</span>
            </button>
            {item.children.length > 0 && (
              <div className={styles.tocRowChildren}>
                <TocList items={item.children} depth={depth + 1} onSelect={onSelect} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function TocDrawer({ items, onSelect, onClose }: Props) {
  return (
    <div className={styles.sheetOverlay} onClick={onClose}>
      <div className={`${styles.bottomSheet} ${styles.tocSheet}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetGrabber} />
        <div className={styles.sheetHeader}>
          <h2 className={styles.sheetTitle}>目录</h2>
          <button className={styles.iconButton} onClick={onClose} title="关闭" aria-label="关闭">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className={styles.sheetBody}>
          {items.length === 0 ? (
            <p className={styles.tocEmptyText}>暂无目录信息</p>
          ) : (
            <div className={styles.tocGroupList}>
              <TocList items={items} depth={0} onSelect={onSelect} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
