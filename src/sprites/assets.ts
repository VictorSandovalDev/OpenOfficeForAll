import { FURNITURE_ASSETS } from './furnitureAssets';

/** Generated pixel assets (PixelLab, see public/assets/pixel/objects/README.md) keyed by object kind, optionally by colour. */
export const OBJECT_ASSETS: Record<string, string> = {
  'pine-tree-large': 'pine-tree-large.png', 'pine-tree-small': 'pine-tree-small.png', 'birch-tree': 'birch-tree.png',
  'maple-tree/lightgreen': 'maple-tree-lightgreen.png', 'maple-tree/green': 'maple-tree-green.png',
  'ficus': 'ficus.png', 'fiddle-leaf-fig': 'fiddle-leaf-fig.png', 'bird-of-paradise-green': 'bird-of-paradise-green.png',
  'bamboo-planter': 'bamboo-planter.png', 'philodendron': 'philodendron.png', 'ceramic-planter/white': 'ceramic-planter-white.png', 'ceramic-planter/brown': 'ceramic-planter-brown.png',
  'arcade-machine': 'arcade-machine.png', 'espresso-machine': 'espresso-machine.png', 'water-cooler': 'water-cooler.png',
  'hardware-dev-computer/blue': 'hardware-dev-computer-blue.png', 'hardware-dev-computer/grey': 'hardware-dev-computer-grey.png', 'digital-artist-computer': 'digital-artist-computer.png',
  'whiteboard': 'whiteboard.png', 'globe': 'globe.png', 'small-fishtank': 'small-fishtank.png', 'molecular-lamp/grey': 'molecular-lamp-grey.png', 'molecular-lamp/black': 'molecular-lamp-black.png',
  'poster-easel/Down': 'poster-easel-down.png', 'poster-easel/Left': 'poster-easel-left.png', 'mini-fridge': 'mini-fridge.png', 'single-coffee-machine': 'single-coffee-machine.png', 'portfolio-drawers': 'portfolio-drawers.png',
  'gamer-chair': 'gamer-chair.png', 'cubicle-shelves/black': 'cubicle-shelves-black.png', 'cubicle-shelves/white': 'cubicle-shelves-white.png', 'floating-bookshelf': 'floating-bookshelf.png',
  'hip-wall-art': 'hip-wall-art.png', 'abstract-painting-rectangles': 'abstract-painting.png', 'mondrian-painting': 'mondrian-painting.png',
  'aloe-vera': 'aloe-vera.png', 'small-potted-hosta/white': 'small-potted-hosta-white.png', 'small-potted-hosta/orange': 'small-potted-hosta-orange.png', 'sprout': 'sprout.png', 'fern': 'fern.png', 'koi-pond': 'koi-pond.png',
};
export function objectAssetUrl(kind: string, color: string, facing = ''): string | null {
  const file = FURNITURE_ASSETS[`${kind}/${color}/${facing}`] ?? OBJECT_ASSETS[`${kind}/${facing}`] ?? OBJECT_ASSETS[`${kind}/${color}`] ?? OBJECT_ASSETS[kind];
  return file ? `/assets/pixel/objects/${file}` : null;
}
