import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { PRODUCT } from "@/config/product";
import { AUTHOR, toJsonLd } from "@/config/seo";
import { GUIDES, getGuide, type Block } from "@/config/guides";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  if (!guide) return {};
  const path = `/guides/${guide.slug}`;
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: path },
    // Setting openGraph here replaces the site-wide one, so the share image is listed again
    openGraph: {
      type: "article",
      url: path,
      title: guide.title,
      description: guide.description,
      modifiedTime: guide.updated,
      images: ["/opengraph-image"],
    },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = getGuide((await params).slug);
  if (!guide) notFound();
  const url = `${PRODUCT.website}/guides/${guide.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: guide.title,
        description: guide.description,
        url,
        dateModified: guide.updated,
        datePublished: guide.updated,
        inLanguage: "en",
        author: { "@type": "Person", name: AUTHOR.name, url: AUTHOR.url },
        publisher: { "@type": "Person", name: AUTHOR.name, url: AUTHOR.url },
        about: { "@id": `${PRODUCT.website}#software` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: PRODUCT.website },
          { "@type": "ListItem", position: 2, name: "Guides", item: `${PRODUCT.website}/guides` },
          { "@type": "ListItem", position: 3, name: guide.title, item: url },
        ],
      },
    ],
  };

  const updated = new Date(guide.updated).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const others = GUIDES.filter((g) => g.slug !== guide.slug);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLd) }} />
      <Navbar />
      <main id="main-content" className="mx-auto w-full max-w-[760px] px-6 pt-32 pb-16 max-md:px-4 max-md:pt-24">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-fg-muted">
          <a href="/" className="hover:text-fg">Home</a>
          <span className="mx-2">/</span>
          <a href="/guides" className="hover:text-fg">Guides</a>
        </nav>

        <article>
          <header className="mb-12">
            <h1 className="font-display text-4xl leading-tight font-bold tracking-[-0.02em] text-fg max-md:text-3xl">
              {guide.title}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-fg-secondary">{guide.description}</p>
            <p className="mt-5 text-sm text-fg-muted">
              Updated <time dateTime={guide.updated}>{updated}</time> · {guide.readMinutes} min read · By{" "}
              <a href={AUTHOR.url} className="text-fg-secondary hover:text-fg" rel="author">
                {AUTHOR.name}
              </a>
            </p>
          </header>

          {guide.sections.map((section) => (
            <section key={section.heading} className="mb-12">
              <h2 className="mb-5 text-2xl font-semibold tracking-[-0.015em] text-fg">{section.heading}</h2>
              <div className="flex flex-col gap-5">
                {section.blocks.map((block, i) => (
                  <GuideBlock key={i} block={block} />
                ))}
              </div>
            </section>
          ))}
        </article>

        <aside className="mt-16 rounded-2xl border border-line-accent bg-accent-subtle p-8 text-center">
          <p className="text-xl font-semibold text-fg">Try PostCompass</p>
          <p className="mt-2 text-fg-secondary">A free, open-source PostgreSQL GUI for Windows, macOS and Linux.</p>
          <a
            href="/download"
            className="mt-6 inline-flex h-11 items-center rounded-lg bg-accent px-6 font-semibold text-[#04120c] hover:bg-accent-hover"
          >
            Download for free
          </a>
        </aside>

        {others.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-5 text-lg font-semibold text-fg">More guides</h2>
            <ul className="flex flex-col gap-3">
              {others.map((g) => (
                <li key={g.slug}>
                  <a href={`/guides/${g.slug}`} className="text-accent-hover hover:underline">
                    {g.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}

function GuideBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "p":
      return <p className="text-[1.05rem] leading-[1.75] text-fg-secondary">{block.text}</p>;
    case "note":
      return (
        <p className="rounded-xl border border-line bg-surface px-5 py-4 text-[0.95rem] leading-relaxed text-fg-secondary">
          <strong className="text-fg">Note: </strong>
          {block.text}
        </p>
      );
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List className={`flex flex-col gap-2.5 pl-6 text-[1.05rem] leading-[1.7] text-fg-secondary ${block.ordered ? "list-decimal" : "list-disc"}`}>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </List>
      );
    }
    case "code":
      return (
        <figure>
          {block.label && <figcaption className="mb-2 text-sm font-medium text-fg-muted">{block.label}</figcaption>}
          <pre className="overflow-x-auto rounded-xl border border-line bg-surface px-5 py-4 font-mono text-[0.9rem] leading-relaxed text-fg">
            <code>{block.code}</code>
          </pre>
        </figure>
      );
  }
}
