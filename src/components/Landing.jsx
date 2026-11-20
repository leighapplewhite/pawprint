import { SiteHeader, SiteFooter, HeartTag, Arch } from './Site';

const ALT = 'Jean Grey, a gray and black puppy with one ice-blue eye, a lavender collar, and a purple heart tag, looking up at the camera';

export default function Landing({ onStart }) {
  return (
    <div className="site">
      <SiteHeader onHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <a href="#features" className="navlink">Features</a>
        <a href="#how" className="navlink">How it works</a>
        <button className="ghost" onClick={() => onStart('signin')}>Sign in</button>
        <button className="primary" onClick={() => onStart('signup')}>Create account</button>
      </SiteHeader>

      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <h1>Your pet’s whole health story, in one place.</h1>
            <p className="hero-sub">
              Pawprint keeps weigh-ins, vaccines, vet visits, food, DNA results, and every photo and
              document for your pet, ready the moment the vet asks.
            </p>
            <div className="cta-row">
              <button className="primary big-btn" onClick={() => onStart('signup')}>Create your account</button>
              <button className="ghost big-btn" onClick={() => onStart('signin')}>Sign in</button>
            </div>
            <p className="muted">Meet Jean Grey, the pup this was built for.</p>
          </div>

          <div className="hero-art">
            <Arch src="/jean-grey.jpg" alt={ALT} className="hero-arch" />
            <div className="tag-swing"><HeartTag line1="Jean" line2="Grey" /></div>
          </div>
        </section>

        <section id="features" className="section wrap">
          <h2 className="section-title">Everything a pet parent ends up needing</h2>
          <div className="bento">
            <article className="blk b-lav span4">
              <h3>Watch them grow</h3>
              <p>Log weigh-ins in kilograms or pounds and watch the growth curve build up over time.</p>
              <svg viewBox="0 0 300 90" className="mini-chart" aria-hidden="true">
                <path d="M10 80C60 76 90 62 130 48s80-30 160-38" fill="none" stroke="var(--plum)" strokeWidth="4" strokeLinecap="round" />
                {[[10, 80], [70, 70], [130, 48], [210, 28], [290, 10]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="6" fill="var(--surface)" stroke="var(--plum)" strokeWidth="3" />)}
              </svg>
            </article>

            <article className="blk b-ice span2">
              <h3>Never miss a booster</h3>
              <p>Each shot gets a stamp that turns amber as the date nears and red when it’s overdue.</p>
              <div className="mini-stamps" aria-hidden="true">
                <span className="mini-stamp ok">Rabies</span>
                <span className="mini-stamp soon">DHPP</span>
              </div>
            </article>

            <article className="blk b-amber span2">
              <h3>Every surgery and sick day</h3>
              <p>Record surgeries, illnesses, injuries, and checkups with the vet, the cost, and your notes.</p>
            </article>

            <article className="blk b-meadow span2">
              <h3>What they eat, and how it goes</h3>
              <p>Track brands, portions, and ratings, plus notes on allergies and tummy trouble.</p>
            </article>

            <article className="blk b-plum span2">
              <h3>Photos and papers in one safe place</h3>
              <p>Upload vaccine certificates, lab results, insurance, and photos. Only your family can see them.</p>
            </article>

            <article className="blk b-ice span3">
              <h3>DNA results that stay put</h3>
              <p>Save the report and the breed breakdown from Embark, Wisdom Panel, or any other provider.</p>
            </article>

            <article className="blk b-lav span3">
              <h3>Find a vet nearby</h3>
              <p>Search by city, ZIP code, or your location, and save the clinics you like.</p>
            </article>

            <article className="blk b-amber span6">
              <h3>Share it with the whole household</h3>
              <p>Invite a partner, a roommate, or the kids with a link. Everyone in the family sees the same pets, records, and photos, and owners can remove anyone at any time.</p>
            </article>
          </div>
        </section>

        <section id="how" className="section wrap">
          <h2 className="section-title">Set up in a few minutes</h2>
          <ol className="steps">
            <li><span className="step-n">1</span><h3>Add your pet</h3><p>Name, breed, birthday, and microchip number.</p></li>
            <li><span className="step-n">2</span><h3>Log as you go</h3><p>Weigh-ins, shots, food changes, vet visits, and photos.</p></li>
            <li><span className="step-n">3</span><h3>Share when it matters</h3><p>Send a boarding kennel or a new vet a link to the right paper.</p></li>
          </ol>
        </section>

        <section className="band">
          <div className="wrap band-in">
            <div>
              <h2>Private by default</h2>
              <p>
                Only people you invite to your family can see your pets. Files sit in private storage,
                and a share link stops working after 48 hours.
              </p>
            </div>
            <button className="on-band big-btn" onClick={() => onStart('signup')}>Create your account</button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
