import styles from "./typingIndicator.module.css";

export default function TypingIndicator() {
  return (
    <div className={styles.bubble} aria-label="Agent is typing">
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </div>
  );
}
