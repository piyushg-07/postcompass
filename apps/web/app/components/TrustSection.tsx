import { Shield, Globe, Lock, Github, Database, Code } from "./Icons";
import styles from "./TrustSection.module.css";

const trustItems = [
  {
    icon: Code,
    title: "Open Source",
    description: "Full source code available on GitHub. Inspect, fork, and contribute.",
  },
  {
    icon: Lock,
    title: "Local-First",
    description: "Connects directly to your database. No data routed through third-party servers.",
  },
  {
    icon: Globe,
    title: "Cross-Platform",
    description: "Native desktop app for Windows, macOS, and Linux. Built with Tauri.",
  },
  {
    icon: Shield,
    title: "Transparent Releases",
    description: "Every release is published on GitHub with changelogs and downloadable assets.",
  },
  {
    icon: Database,
    title: "PostgreSQL Native",
    description: "Built specifically for PostgreSQL. Supports every data type, extension, and feature.",
  },
  {
    icon: Github,
    title: "Community Driven",
    description: "Issues, discussions, and contributions welcome. Built by developers, for developers.",
  },
];

export default function TrustSection() {
  return (
    <section className={styles.trust}>
      <div className="container">
        <div className={styles.grid}>
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className={styles.item}>
                <div className={styles.iconWrap}>
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className={styles.itemTitle}>{item.title}</h3>
                  <p className={styles.itemDesc}>{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
