const prohibitedColours = ['Red', 'Black', 'Gold', 'Silver', 'White', 'Neon'];

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
          {prohibitedColours.map((colour) => (
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
    </section>
  );
}
