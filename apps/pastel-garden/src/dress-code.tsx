const prohibitedColours = [
  { name: 'Red', background: '#bd5559' },
  { name: 'Black', background: '#33343a' },
  { name: 'Gold', background: 'linear-gradient(135deg, #dcc78a, #ad8743)' },
  { name: 'Silver', background: 'linear-gradient(135deg, #eceef1, #a3aab4)' },
  { name: 'White', background: '#fff' },
  { name: 'Neon colours', background: 'linear-gradient(135deg, #ceff39, #ff63c7)' },
];

export function DressCode() {
  return (
    <section className="dress-code-section" aria-labelledby="dress-code-heading">
      <div className="dress-code-copy">
        <h2 id="dress-code-heading">Guest Dress Code</h2>
        <img
          className="dress-code-artwork"
          src="./media/rizzoli-dress-code.webp"
          alt="Guests in pastel dresses and suits around flower-decorated cocktail tables in a garden"
          width="1672"
          height="941"
          loading="lazy"
        />
        <ul className="dress-code-avoid" aria-label="Colours to avoid">
          {prohibitedColours.map(({ name, background }) => (
            <li key={name}>
              <span className="colour-swatch" style={{ background }} aria-hidden="true">
                <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
                  <path className="swatch-slash-outline" d="m7 7 26 26" />
                  <path d="m7 7 26 26" />
                </svg>
              </span>
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
