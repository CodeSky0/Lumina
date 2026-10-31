import { Barbell, BookOpen, Calculator, Flask, Globe, Laptop, MusicNotes, Palette, type Icon } from "@phosphor-icons/react";

const icons: Record<string, Icon> = {
  book: BookOpen,
  chinese: BookOpen,
  math: Calculator,
  calculator: Calculator,
  science: Flask,
  flask: Flask,
  geography: Globe,
  globe: Globe,
  computer: Laptop,
  laptop: Laptop,
  music: MusicNotes,
  art: Palette,
  sports: Barbell,
};

export function SubjectIcon({ name, className }: { name?: string; className?: string }) {
  const IconComponent = (name && icons[name.toLowerCase()]) || BookOpen;
  return <IconComponent className={className} weight="duotone" aria-hidden="true" />;
}
