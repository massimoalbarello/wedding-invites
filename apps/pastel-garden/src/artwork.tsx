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
