export function FloralFrame() {
  return <div className="floral-frame" aria-hidden="true" />;
}

export function VenueArtwork({ className = '' }: { className?: string }) {
  return (
    <img
      className={`venue-artwork ${className}`}
      src="./media/casiglio-venue.webp"
      alt="The pink villa of Castello di Casiglio, with the stone castle alongside it"
      width="1536"
      height="1024"
    />
  );
}

export function GardenScene() {
  return (
    <div className="garden-scene" aria-hidden="true">
      <VenueArtwork />
      <img
        className="garden-aisle"
        src="./media/ceremony-garden.webp"
        alt=""
        width="1536"
        height="1024"
      />
    </div>
  );
}
