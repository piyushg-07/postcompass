// Guides: practical answers to common PostgreSQL questions. Keep every step accurate and testable;
// these pages are what search engines rank and AI assistants quote.

export type Block =
  | { type: "p"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "code"; code: string; label?: string }
  | { type: "note"; text: string };

export interface GuideSection {
  heading: string;
  blocks: Block[];
}

export interface Guide {
  slug: string;
  title: string;
  /** Meta description and the intro under the title */
  description: string;
  /** ISO date the content was last checked */
  updated: string;
  readMinutes: number;
  sections: GuideSection[];
}

export const GUIDES: Guide[] = [
  {
    slug: "run-postgresql-locally-without-docker",
    title: "How to run PostgreSQL locally without Docker",
    description:
      "Three ways to get a local PostgreSQL server on Windows, macOS or Linux without Docker: a one-click app, your system's package manager, or the official installer.",
    updated: "2026-10-25",
    readMinutes: 5,
    sections: [
      {
        heading: "Why skip Docker for local PostgreSQL?",
        blocks: [
          {
            type: "p",
            text: "Docker is a great way to run PostgreSQL, but for day-to-day development it adds a background engine, volume mounts and port mappings to think about. On Windows and macOS it also runs inside a virtual machine. If you just want a database on localhost for an app you're building, running PostgreSQL directly is simpler and starts faster.",
          },
        ],
      },
      {
        heading: "Option 1: One click with PostCompass (Windows, macOS, Linux)",
        blocks: [
          {
            type: "p",
            text: "PostCompass is a free, open-source PostgreSQL GUI that can also install and run PostgreSQL for you. It downloads the official PostgreSQL binaries for your system, verifies their SHA-256 checksum and runs the server as your user, so no admin rights are needed.",
          },
          {
            type: "list",
            ordered: true,
            items: [
              "Download PostCompass for your system from the download page and open it.",
              "In the setup, choose Install PostgreSQL, or later go to Databases and click New local database.",
              "Pick a version (PostgreSQL 14 to 18), a port and a password, then click Install.",
              "When it finishes, click Open to browse tables and run SQL, or copy the connection string for your app.",
            ],
          },
          {
            type: "p",
            text: "The server listens only on 127.0.0.1, uses scram-sha-256 authentication, and the password is stored in your operating system's keychain. You can start, stop, back up and remove the server from the Databases page.",
          },
          {
            type: "code",
            label: "Connection string for your app",
            code: "postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/postgres",
          },
        ],
      },
      {
        heading: "Option 2: Your system's package manager",
        blocks: [
          { type: "p", text: "Package managers install PostgreSQL as a system service. They usually need admin rights." },
          {
            type: "code",
            label: "macOS (Homebrew)",
            code: "brew install postgresql@18\nbrew services start postgresql@18",
          },
          {
            type: "code",
            label: "Ubuntu / Debian",
            code: "sudo apt update\nsudo apt install postgresql\nsudo systemctl start postgresql",
          },
          {
            type: "code",
            label: "Fedora",
            code: "sudo dnf install postgresql-server\nsudo postgresql-setup --initdb\nsudo systemctl start postgresql",
          },
          {
            type: "note",
            text: "Distribution packages often ship an older PostgreSQL major version. For a specific version, use the PostgreSQL project's own apt or yum repository.",
          },
        ],
      },
      {
        heading: "Option 3: The official installer (Windows and macOS)",
        blocks: [
          {
            type: "p",
            text: "postgresql.org links to graphical installers for Windows and macOS. They install PostgreSQL as a system service that starts with your computer, and need admin rights to install.",
          },
        ],
      },
      {
        heading: "Which should you choose?",
        blocks: [
          {
            type: "list",
            items: [
              "Want a database for development, no admin rights, several versions side by side and a GUI included: PostCompass.",
              "Want PostgreSQL managed like other system software, or are on a server: your package manager.",
              "Want a traditional installer with a system service: the official installer.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "connect-to-aws-rds-postgresql",
    title: "How to connect to AWS RDS PostgreSQL with a GUI",
    description:
      "Connect a PostgreSQL GUI to Amazon RDS or Aurora PostgreSQL: find the endpoint, open the security group, and use SSL with the RDS certificate bundle.",
    updated: "2026-10-25",
    readMinutes: 4,
    sections: [
      {
        heading: "What you need",
        blocks: [
          {
            type: "list",
            items: [
              "The instance endpoint, from the RDS console under Connectivity & security (for example mydb.abc123.us-east-1.rds.amazonaws.com).",
              "The port, 5432 unless you changed it.",
              "The master username and password you set when creating the database, or another database user.",
              "Network access from your computer, described below.",
            ],
          },
        ],
      },
      {
        heading: "Allow your computer to reach the database",
        blocks: [
          {
            type: "p",
            text: "If the instance has public access enabled, add an inbound rule to its VPC security group for TCP port 5432 from your IP address. If it's private, connect through a VPN, AWS Client VPN or a bastion host inside the VPC instead.",
          },
          {
            type: "note",
            text: "Only allow your own IP address. Opening port 5432 to 0.0.0.0/0 exposes the database to the whole internet.",
          },
        ],
      },
      {
        heading: "Connect with PostCompass",
        blocks: [
          {
            type: "list",
            ordered: true,
            items: [
              "Open Databases and click Add remote connection.",
              "Choose AWS RDS / Aurora as the provider. Encryption is set to Require automatically.",
              "Paste the endpoint as the host, then enter the port, user, password and database (often postgres).",
              "Click Test connection, then Add connection.",
            ],
          },
        ],
      },
      {
        heading: "Verify the server certificate (recommended)",
        blocks: [
          {
            type: "p",
            text: "Require encrypts traffic but doesn't check who you're talking to. For full protection against man-in-the-middle attacks, download Amazon's certificate bundle and choose Verify certificate.",
          },
          {
            type: "code",
            label: "RDS global certificate bundle",
            code: "https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem",
          },
          {
            type: "p",
            text: "In PostCompass, set Encryption to Verify certificate and select the downloaded global-bundle.pem as the CA certificate.",
          },
        ],
      },
      {
        heading: "Troubleshooting",
        blocks: [
          {
            type: "list",
            items: [
              "Connection times out: the security group or network doesn't allow your IP, or the instance isn't publicly accessible.",
              "Password authentication failed: check the username and password; RDS usernames are case-sensitive.",
              "SSL error with Verify certificate: make sure you selected the RDS bundle and used the instance endpoint, not an IP address.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "read-postgresql-explain-analyze",
    title: "How to read PostgreSQL EXPLAIN ANALYZE output",
    description:
      "Understand PostgreSQL query plans: what EXPLAIN and EXPLAIN ANALYZE show, the common plan nodes, and how to find the slow step in a query.",
    updated: "2026-10-25",
    readMinutes: 6,
    sections: [
      {
        heading: "EXPLAIN vs EXPLAIN ANALYZE",
        blocks: [
          {
            type: "p",
            text: "EXPLAIN shows the plan PostgreSQL intends to use and its estimates, without running the query. EXPLAIN ANALYZE actually runs the query and adds real timings and row counts to each step.",
          },
          {
            type: "code",
            code: "EXPLAIN ANALYZE\nSELECT * FROM orders WHERE customer_id = 42;",
          },
          {
            type: "note",
            text: "EXPLAIN ANALYZE really executes the statement, so an UPDATE or DELETE will change data. Wrap it in BEGIN; … ROLLBACK; to be safe.",
          },
        ],
      },
      {
        heading: "Reading a plan node",
        blocks: [
          {
            type: "code",
            code: "Seq Scan on orders  (cost=0.00..1834.00 rows=98 width=64)\n                    (actual time=0.015..12.401 rows=104 loops=1)\n  Filter: (customer_id = 42)\n  Rows Removed by Filter: 99896",
          },
          {
            type: "list",
            items: [
              "cost=start..total: the planner's estimate in arbitrary units. Compare costs between plans, not to milliseconds.",
              "rows (estimate) vs actual rows: a big gap means the planner's statistics are off. Running ANALYZE on the table often helps.",
              "actual time=first..last: milliseconds to the first row and to the last row, per loop.",
              "loops: how many times the step ran. Multiply time and rows by loops for the real total.",
              "Rows Removed by Filter: rows read and then thrown away. A large number here often means a missing index.",
            ],
          },
        ],
      },
      {
        heading: "Common plan nodes",
        blocks: [
          {
            type: "list",
            items: [
              "Seq Scan: reads the whole table. Fine for small tables; slow on big ones when you only need a few rows.",
              "Index Scan / Index Only Scan: uses an index to find rows. Index Only Scan doesn't need to visit the table at all.",
              "Bitmap Heap Scan: collects matching row locations from an index first, then reads them in bulk. Good for medium result sets.",
              "Nested Loop: for each row on one side, looks up matches on the other. Fast when the outer side is small and the inner side is indexed.",
              "Hash Join: builds a hash table from one side. Good for joining larger sets without useful indexes.",
              "Sort / HashAggregate: sorting and grouping. Watch for 'external merge Disk' in a Sort, which means it ran out of work_mem.",
            ],
          },
        ],
      },
      {
        heading: "Finding the slow step",
        blocks: [
          {
            type: "list",
            ordered: true,
            items: [
              "Look for the node with the largest actual time multiplied by loops; parents include their children's time.",
              "Compare estimated and actual rows. Estimates off by 10x or more point to stale statistics or a complex filter.",
              "Check Seq Scans with many Rows Removed by Filter; an index on the filtered column usually fixes them.",
              "Add BUFFERS (EXPLAIN (ANALYZE, BUFFERS)) to see how much data came from disk versus cache.",
            ],
          },
          {
            type: "p",
            text: "PostCompass shows EXPLAIN ANALYZE as a visual tree with timing bars, flags the slowest step, highlights estimate-versus-actual mismatches, and runs ANALYZE inside a transaction that's rolled back, so it's safe on writes.",
          },
        ],
      },
    ],
  },
];

export function getGuide(slug: string) {
  return GUIDES.find((g) => g.slug === slug);
}
