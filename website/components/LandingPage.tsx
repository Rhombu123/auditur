import Link from "next/link";

import { BrandLogo } from "@/components/BrandLogo";
import styles from "@/components/LandingPage.module.css";

const workflow = [
  {
    number: "01",
    title: "Upload the price list",
    copy: "Auditur turns the dealership PDF into a clean, searchable inventory baseline.",
  },
  {
    number: "02",
    title: "Walk and scan",
    copy: "Every VIN scan captures time and GPS while your team moves through the lot.",
  },
  {
    number: "03",
    title: "Close the gaps",
    copy: "Managers see missing, moved, and off-list vehicles before the day ends.",
  },
] as const;

const activity = [
  { vin: "4S4BSAKC", model: "2025 Outback", zone: "Online", time: "9:42" },
  { vin: "1FMCU9G6", model: "2024 Escape", zone: "Front row", time: "9:40" },
  { vin: "3C6UR5FL", model: "2025 Ram 2500", zone: "Service", time: "9:38" },
] as const;

export function LandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Link href="/" className={styles.brand} aria-label="Auditur home">
          <BrandLogo size={34} className={styles.brandLogo} priority />
          <span>Auditur</span>
        </Link>
        <nav className={styles.navLinks} aria-label="Main navigation">
          <a href="#workflow">Workflow</a>
          <a href="#product">Product</a>
          <a href="#features">Features</a>
        </nav>
        <div className={styles.navActions}>
          <Link href="/login/?next=%2Fdashboard%2F" className={styles.signIn}>
            Sign in
          </Link>
          <Link href="/signup/?next=%2Fdashboard%2F" className={styles.navCta}>
            Create workspace
          </Link>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>
              <i aria-hidden />
              Live dealership inventory control
            </span>
            <h1>
              Walk the lot once.
              <span>Know what&apos;s missing.</span>
            </h1>
            <p>
              Upload your price list, scan VINs with GPS, and give managers a live
              audit of every vehicle on the lot.
            </p>
            <div className={styles.heroActions}>
              <Link href="/signup/?next=%2Fdashboard%2F" className={styles.primaryCta}>
                Create your workspace
                <span aria-hidden>→</span>
              </Link>
              <a href="#workflow" className={styles.secondaryCta}>
                See the workflow
              </a>
            </div>
            <div className={styles.heroProof}>
              <span>Price list in</span>
              <i aria-hidden />
              <span>GPS-backed scans</span>
              <i aria-hidden />
              <span>Audit proof out</span>
            </div>
          </div>

          <div className={styles.productWindow} aria-label="Auditur product preview">
            <div className={styles.windowTop}>
              <div className={styles.windowBrand}>
                <BrandLogo size={24} className={styles.windowLogo} />
                <span>Lot Desk</span>
              </div>
              <div className={styles.windowStatus}>
                <i aria-hidden />
                Live
              </div>
            </div>
            <div className={styles.windowBody}>
              <aside className={styles.previewNav} aria-hidden>
                <span className={styles.previewNavActive}>Overview</span>
                <span>Audit</span>
                <span>Vehicles</span>
                <span>Map</span>
              </aside>
              <div className={styles.previewMain}>
                <div className={styles.previewHeading}>
                  <div>
                    <small>Tuesday, July 14</small>
                    <strong>Lot overview</strong>
                  </div>
                  <span>Lot A</span>
                </div>
                <div className={styles.kpiGrid}>
                  <div>
                    <small>Expected</small>
                    <strong>186</strong>
                    <em>Current list</em>
                  </div>
                  <div>
                    <small>Scanned</small>
                    <strong>171</strong>
                    <em className={styles.positive}>92% complete</em>
                  </div>
                  <div>
                    <small>Remaining</small>
                    <strong>15</strong>
                    <em>Needs review</em>
                  </div>
                </div>
                <div className={styles.previewGrid}>
                  <div className={styles.auditCard}>
                    <div className={styles.cardHead}>
                      <span>Today&apos;s audit</span>
                      <strong>92%</strong>
                    </div>
                    <div className={styles.progressTrack}>
                      <span />
                    </div>
                    <div className={styles.auditLegend}>
                      <span><i className={styles.tealDot} />171 scanned</span>
                      <span><i className={styles.grayDot} />15 remaining</span>
                    </div>
                  </div>
                  <div className={styles.mapCard}>
                    <span className={`${styles.zone} ${styles.zoneOne}`}>Front</span>
                    <span className={`${styles.zone} ${styles.zoneTwo}`}>Online</span>
                    <span className={`${styles.zone} ${styles.zoneThree}`}>Service</span>
                    <i className={`${styles.pin} ${styles.pinOne}`} />
                    <i className={`${styles.pin} ${styles.pinTwo}`} />
                    <i className={`${styles.pin} ${styles.pinThree}`} />
                    <small>GPS lot view</small>
                  </div>
                </div>
                <div className={styles.activityCard}>
                  <div className={styles.activityHead}>
                    <strong>Live scan feed</strong>
                    <span>From phones</span>
                  </div>
                  {activity.map((item) => (
                    <div className={styles.activityRow} key={item.vin}>
                      <span className={styles.vin}>{item.vin}</span>
                      <span>{item.model}</span>
                      <em>{item.zone}</em>
                      <small>{item.time}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.proofBar} aria-label="Auditur outcomes">
          <div>
            <strong>One source</strong>
            <span>Your latest dealership price list</span>
          </div>
          <div>
            <strong>Every scan</strong>
            <span>VIN, timestamp, and GPS evidence</span>
          </div>
          <div>
            <strong>One answer</strong>
            <span>What is here, missing, or out of place</span>
          </div>
        </section>

        <section className={styles.workflowSection} id="workflow">
          <div className={styles.sectionIntro}>
            <span>One clear workflow</span>
            <h2>From PDF to a verified lot audit.</h2>
            <p>
              Your team keeps walking. Auditur handles the reconciliation in the
              background.
            </p>
          </div>
          <div className={styles.workflowGrid}>
            {workflow.map((step) => (
              <article className={styles.workflowCard} key={step.number}>
                <span>{step.number}</span>
                <div className={styles.stepIcon} aria-hidden>
                  {step.number === "01" ? "PDF" : step.number === "02" ? "VIN" : "✓"}
                </div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.productSection} id="product">
          <div className={styles.productCopy}>
            <span>Operational clarity</span>
            <h2>The lot tells you what changed.</h2>
            <p>
              Every scan updates the dashboard, map, and daily audit. Owners and
              managers see the same truth as the team walking outside.
            </p>
            <ul>
              <li><i aria-hidden />Search any VIN in seconds</li>
              <li><i aria-hidden />See which section holds each vehicle</li>
              <li><i aria-hidden />Export a highlighted audit PDF</li>
            </ul>
          </div>
          <div className={styles.lotVisual}>
            <div className={styles.lotToolbar}>
              <span>Satellite lot view</span>
              <strong>186 vehicles</strong>
            </div>
            <div className={styles.lotMap}>
              <span className={`${styles.lotZone} ${styles.frontZone}`}>Front row · 54</span>
              <span className={`${styles.lotZone} ${styles.onlineZone}`}>Online · 38</span>
              <span className={`${styles.lotZone} ${styles.serviceZone}`}>Service · 21</span>
              <span className={`${styles.lotZone} ${styles.overflowZone}`}>Overflow · 73</span>
              <i className={`${styles.bigPin} ${styles.bigPinOne}`} />
              <i className={`${styles.bigPin} ${styles.bigPinTwo}`} />
              <i className={`${styles.bigPin} ${styles.bigPinThree}`} />
              <i className={`${styles.bigPin} ${styles.bigPinFour}`} />
            </div>
          </div>
        </section>

        <section className={styles.featuresSection} id="features">
          <div className={styles.sectionIntro}>
            <span>Built for the workday</span>
            <h2>Fewer spreadsheets. Faster decisions.</h2>
          </div>
          <div className={styles.bentoGrid}>
            <article className={styles.bentoWide}>
              <small>Live reconciliation</small>
              <h3>See the audit move with every scan.</h3>
              <p>Missing and off-list counts update while the team walks.</p>
              <div className={styles.miniChart}>
                <span style={{ height: "36%" }} />
                <span style={{ height: "48%" }} />
                <span style={{ height: "62%" }} />
                <span style={{ height: "78%" }} />
                <span style={{ height: "92%" }} />
              </div>
            </article>
            <article>
              <small>Account control</small>
              <h3>Add employees by their Auditur ID.</h3>
              <p>Keep names and emails private while assigning clear roles.</p>
              <div className={styles.idChip}>482 736 195</div>
            </article>
            <article>
              <small>Field proof</small>
              <h3>GPS and time on every unit.</h3>
              <p>Know where and when each vehicle was verified.</p>
              <div className={styles.proofPills}>
                <span>GPS locked</span>
                <span>9:42 AM</span>
              </div>
            </article>
          </div>
        </section>

        <section className={styles.finalCta}>
          <div>
            <span>Ready for today&apos;s walk?</span>
            <h2>Turn your next price list into a live lot audit.</h2>
          </div>
          <Link href="/signup/?next=%2Fdashboard%2F" className={styles.lightCta}>
            Create your workspace
            <span aria-hidden>→</span>
          </Link>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <BrandLogo size={32} className={styles.footerLogo} />
          <div>
            <strong>Auditur</strong>
            <span>Dealership lot auditing, simplified.</span>
          </div>
        </div>
        <div className={styles.footerLinks}>
          <a href="#workflow">Workflow</a>
          <a href="#product">Product</a>
          <Link href="/login/?next=%2Fdashboard%2F">Manager sign in</Link>
        </div>
        <small>© {new Date().getFullYear()} Auditur</small>
      </footer>
    </div>
  );
}
