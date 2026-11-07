export function DressCode() {
  return (
    <section className="dress-code-section" aria-labelledby="dress-code-heading">
      <div className="dress-code-copy">
        <h2 id="dress-code-heading">Guest Dress Code</h2>
        <p className="eyebrow">Elegant &amp; celebratory</p>
        <p className="dress-code-intro">
          Join us in elegant attire in soft, muted colours, inspired by our garden celebration.
        </p>
        <img
          className="dress-code-artwork"
          src="./media/rizzoli-dress-code.webp"
          alt="Wedding guests in varied soft colours beside the twin stone arches of the amphitheatre at Villa Ex Magni Rizzoli"
          width="1536"
          height="1024"
          loading="lazy"
        />
        <div className="dress-code-attire">
          <div>
            <h3 className="eyebrow">For women</h3>
            <p>
              Midi or floor-length dresses, elegant separates or chic suits in soft, muted tones.
            </p>
          </div>
          <div>
            <h3 className="eyebrow">For men</h3>
            <p>
              Suits or smart separates in soft, elegant shades that complement our garden palette.
            </p>
          </div>
        </div>
        <div className="dress-code-avoid">
          <h3 className="eyebrow">We kindly ask all guests to avoid</h3>
          <ul>
            {['Red', 'Black', 'Gold', 'Silver', 'White', 'Neon colours'].map((colour) => (
              <li key={colour}>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="m5.6 5.6 12.8 12.8" />
                </svg>
                {colour}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
