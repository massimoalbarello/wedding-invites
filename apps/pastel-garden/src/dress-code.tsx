const prohibitedColours = [
  { name: 'Red', fill: '#c94343' },
  { name: 'Black', fill: '#252525' },
  { name: 'Gold', fill: '#d4af37' },
  { name: 'Silver', fill: '#c0c0c0' },
  { name: 'White', fill: '#fff' },
  { name: 'Neon', fill: '#baff00' },
];

export function DressCode() {
  return (
    <section className="dress-code-section" aria-labelledby="dress-code-heading">
      <div className="dress-code-copy">
        <h2 id="dress-code-heading">Dress Code</h2>
        <p>Soft pastels encouraged</p>
        <img
          className="dress-code-artwork"
          src="./media/rizzoli-dress-code.webp"
          alt="Guests in pastel dresses and suits around flower-decorated cocktail tables in a garden"
          width="1672"
          height="941"
          loading="lazy"
        />
        <div className="dress-code-guidance">
          <h3 id="dress-code-avoid-heading">Please avoid these dress colours</h3>
          <ul className="dress-code-avoid" aria-labelledby="dress-code-avoid-heading">
            {prohibitedColours.map(({ name, fill }) => (
              <li key={name}>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" fill={fill} />
                  <path d="m5.6 5.6 12.8 12.8" />
                </svg>
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
