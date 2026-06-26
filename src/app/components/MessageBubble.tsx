import styles from "./messageBubble.module.css";

type Props = {
  sender: "user" | "ai";
  text: string;
};

export default function MessageBubble({ sender, text }: Props) {
  return (
    <div className={`${styles.bubble} ${styles[sender]}`}>{text}</div>
  );
}
