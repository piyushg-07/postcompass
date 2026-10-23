import { Download, Database, Table } from "./Icons";
import styles from "./HowItWorks.module.css";

const STEPS = [
  {
    icon: Download,
    title: "Download the app",
    text: "Grab the installer for Windows, macOS or Linux. On Windows it's about 3 MB. No account, no sign-up.",
    detail: ["setup.exe", ".dmg", ".AppImage"],
  },
  {
    icon: Database,
    title: "Create or connect",
    text: "Click New local database and PostgreSQL is running in a minute, or add a connection to RDS, Supabase, Neon and more.",
    detail: ["PostgreSQL 14 – 18", "Cloud presets"],
  },
  {
    icon: Table,
    title: "Explore your data",
    text: "Open a table to filter and edit rows, write SQL with autocomplete, explain slow queries and map your schema.",
    detail: ["Ctrl K to jump anywhere"],
  },
];

export default function HowItWorks() {
  return (
    <section className="section" id="how-it-works">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">How it works</span>
          <h2 className="section-title">From download to your first query in minutes</h2>
          <p className="section-description">No Docker, no config files, no background services to babysit.</p>
        </div>

        <ol className={styles.steps}>
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.title} className={styles.step}>
                <div className={styles.stepTop}>
                  <span className={styles.icon}>
                    <Icon size={18} />
                  </span>
                  <span className={styles.number}>0{i + 1}</span>
                </div>
                <h3 className={styles.title}>{s.title}</h3>
                <p className={styles.text}>{s.text}</p>
                <div className={styles.tags}>
                  {s.detail.map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
