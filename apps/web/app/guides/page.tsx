import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { GUIDES } from "@/config/guides";

export const metadata: Metadata = {
  title: "PostgreSQL Guides",
  description:
    "Practical PostgreSQL guides: run PostgreSQL locally without Docker, connect to AWS RDS, read EXPLAIN ANALYZE output and more.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="mx-auto w-full max-w-[760px] px-6 pt-32 pb-16 max-md:px-4 max-md:pt-24">
        <h1 className="font-display text-4xl leading-tight font-bold tracking-[-0.02em] text-fg max-md:text-3xl">
          PostgreSQL guides
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-fg-secondary">
          Short, practical answers to common PostgreSQL questions.
        </p>
        <ul className="mt-12 flex flex-col gap-4">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <a
                href={`/guides/${g.slug}`}
                className="block rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-line-hover"
              >
                <h2 className="text-xl font-semibold text-fg">{g.title}</h2>
                <p className="mt-2 leading-relaxed text-fg-secondary">{g.description}</p>
                <p className="mt-3 text-sm text-fg-muted">{g.readMinutes} min read</p>
              </a>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
