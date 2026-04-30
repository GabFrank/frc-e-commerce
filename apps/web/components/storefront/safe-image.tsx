import Image from 'next/image';

/**
 * Wrapper sobre Next/Image que detecta data: URLs (usadas por el stub R2 actual)
 * y las renderiza como <img> normal — Next/Image no procesa data URLs.
 */
export function SafeImage({
  src,
  alt,
  className,
  fill,
  sizes,
  priority,
  width,
  height,
}: {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
  width?: number;
  height?: number;
}) {
  const isData = src.startsWith('data:');
  if (isData) {
    if (fill) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={src} alt={alt} className={`absolute inset-0 h-full w-full ${className ?? ''}`} />;
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} width={width} height={height} />;
  }
  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      {...(fill ? { fill: true } : { width: width ?? 600, height: height ?? 600 })}
      sizes={sizes}
      priority={priority}
    />
  );
}
